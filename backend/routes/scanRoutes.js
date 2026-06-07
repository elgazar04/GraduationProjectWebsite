const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const axios = require('axios');
const FormData = require('form-data');
const db = require('../db');
const { protect } = require('../middleware/authMiddleware');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const router = express.Router();

// Multer storage
const storage = multer.diskStorage({
  destination(req, file, cb) { cb(null, 'uploads/'); },
  filename(req, file, cb) { cb(null, `${Date.now()}-${file.originalname}`); }
});
const upload = multer({ storage });

// @route   POST /api/scans/upload
router.post('/upload', protect, upload.single('image'), async (req, res) => {
  try {
    const intakeData = JSON.parse(req.body.intakeData || '{}');
    const scanId = uuidv4();
    const imageUrl = `/uploads/${req.file.filename}`;

    // Get the full patient profile from database
    const [profiles] = await db.query('SELECT * FROM PatientProfiles WHERE user_id = ?', [req.user.id]);
    if (profiles.length === 0) return res.status(400).json({ message: 'Patient profile not found' });
    const profile = profiles[0];
    const patientProfileId = profile.id;

    // Convert stored DB fields back to the intakeData format for merging
    const dbIntake = {
      age: profile.age,
      gender: profile.gender,
      smoking_status: profile.smoking_status || 'Never',
      diabetes: profile.diabetes === 1,
      hypertension: profile.hypertension === 1,
      prior_cancer: profile.family_cancer_history === 1,
      prior_brain_surgery: profile.previous_treatment === 1,
      immunosuppressed: profile.immunosuppressed === 1,
      seizures: profile.seizure_history === 1,
      headache_severity: profile.headache_severity || 5,
      symptom_duration_weeks: profile.symptom_duration_weeks || 4,
      functional_status: profile.functional_status === 'needs_some_help' ? 'Some help' : 
                         profile.functional_status === 'needs_significant_help' ? 'Significant help' : 
                         profile.functional_status === 'fully_dependent' ? 'Bed-bound' : 'Independent',
      neurological_symptoms: profile.neurological_symptoms === 'mild' ? 1 : 
                             profile.neurological_symptoms === 'moderate' ? 2 : 
                             profile.neurological_symptoms === 'severe' ? 3 : 0
    };

    // Merge incoming intakeData on top of the DB intake data
    const mergedIntake = { ...dbIntake };
    Object.keys(intakeData).forEach(key => {
      if (intakeData[key] !== null && intakeData[key] !== undefined && intakeData[key] !== '') {
        mergedIntake[key] = intakeData[key];
      }
    });

    // Map functional status to DB enum
    const functionalStatusMap = {
      'Independent': 'independent',
      'Some help': 'needs_some_help',
      'Significant help': 'needs_significant_help',
      'Bed-bound': 'fully_dependent'
    };
    const dbFunctionalStatus = functionalStatusMap[mergedIntake.functional_status] || 'independent';

    // Map neurological symptoms to DB enum
    const neurologicalSymptomsMap = {
      0: 'none',
      1: 'mild',
      2: 'moderate',
      3: 'severe'
    };
    const dbNeurologicalSymptoms = neurologicalSymptomsMap[mergedIntake.neurological_symptoms] || 'none';

    const comorbiditiesStr = `Diabetes: ${mergedIntake.diabetes ? 'Yes' : 'No'}, Hypertension: ${mergedIntake.hypertension ? 'Yes' : 'No'}`;

    // Update Patient Profile with complete merged intake data
    await db.query(`
      UPDATE PatientProfiles SET
        age = ?, 
        gender = ?, 
        family_cancer_history = ?, 
        previous_treatment = ?,
        comorbidities = ?,
        headache_severity = ?, 
        seizure_history = ?, 
        functional_status = ?,
        neurological_symptoms = ?,
        immunosuppressed = ?,
        smoking_status = ?,
        symptom_duration_weeks = ?,
        diabetes = ?,
        hypertension = ?
      WHERE id = ?
    `, [
      mergedIntake.age || null, 
      mergedIntake.gender || null, 
      mergedIntake.prior_cancer || false, 
      mergedIntake.prior_brain_surgery || false,
      comorbiditiesStr,
      mergedIntake.headache_severity || 5,
      mergedIntake.seizures || false,
      dbFunctionalStatus,
      dbNeurologicalSymptoms,
      mergedIntake.immunosuppressed || false,
      mergedIntake.smoking_status || 'Never',
      mergedIntake.symptom_duration_weeks || 4,
      mergedIntake.diabetes || false,
      mergedIntake.hypertension || false,
      patientProfileId
    ]);

    // Create the scan record
    await db.query(
      'INSERT INTO Scans (id, patient_id, mri_file_path, status) VALUES (?, ?, ?, ?)',
      [scanId, patientProfileId, imageUrl, 'processing']
    );

    // Real AI Pipeline — fire-and-forget
    (async () => {
      try {
        const form = new FormData();
        const imagePath = path.resolve(__dirname, '..', req.file.path);
        form.append('image', fs.createReadStream(imagePath));

        form.append('age',                    String(mergedIntake.age || 30));
        form.append('sex',                    mergedIntake.gender === 'female' ? 'F' : 'M');
        form.append('smoking_status',         mergedIntake.smoking_status || 'Never');
        form.append('diabetes',               String(mergedIntake.diabetes ? 1 : 0));
        form.append('hypertension',           String(mergedIntake.hypertension ? 1 : 0));
        form.append('prior_cancer',           String(mergedIntake.prior_cancer ? 1 : 0));
        form.append('prior_brain_surgery',    String(mergedIntake.prior_brain_surgery ? 1 : 0));
        form.append('immunosuppressed',       String(mergedIntake.immunosuppressed ? 1 : 0));
        form.append('seizures',               String(mergedIntake.seizures ? 1 : 0));
        form.append('headache_severity',      String(mergedIntake.headache_severity || 5));
        form.append('symptom_duration_weeks',  String(mergedIntake.symptom_duration_weeks || 4));
        form.append('functional_status',      mergedIntake.functional_status || 'Independent');
        form.append('neurological_symptoms',  String(mergedIntake.neurological_symptoms ? 1 : 0));

        console.log(`[AI] Sending MRI to FastAPI: ${AI_SERVICE_URL}/predict`);
        const aiResponse = await axios.post(`${AI_SERVICE_URL}/predict`, form, {
          headers: form.getHeaders(),
          timeout: 60000,
          maxContentLength: 50 * 1024 * 1024,
        });

        const ai = aiResponse.data;
        console.log(`[AI] Pipeline result: ${ai.tumor_type} (${(ai.confidence * 100).toFixed(1)}%) -> ${ai.triage_tier}`);

        // Save segmentation overlay to disk if available
        let segMaskPath = null;
        if (ai.overlay_image) {
          const maskFilename = `seg-${scanId}.png`;
          const maskDiskPath = path.resolve(__dirname, '..', 'uploads', maskFilename);
          fs.writeFileSync(maskDiskPath, Buffer.from(ai.overlay_image, 'base64'));
          segMaskPath = `/uploads/${maskFilename}`;
        }

        // Map triage_tier to DB enum
        const triageTierMap = { 'Emergency': 'emergency', 'Urgent': 'urgent', 'Routine': 'routine' };
        const triageTier = triageTierMap[ai.triage_tier] || 'routine';

        // Update the Scans table with real AI results
        await db.query(
          `UPDATE Scans SET 
            status = 'completed',
            tumor_type = ?,
            tumor_location = ?,
            tumor_size_mm2 = ?,
            hemisphere = ?,
            classification_confidence = ?,
            treatment_plan = ?,
            urgency_level = ?,
            triage_tier = ?,
            segmentation_mask_path = ?
           WHERE id = ?`,
          [
            ai.tumor_type,
            ai.location_detail || ai.tumor_location,
            ai.tumor_size_mm2,
            ai.hemisphere === 'L' ? 'left' : ai.hemisphere === 'R' ? 'right' : null,
            ai.confidence,
            ai.treatment_plan,
            ai.urgency_level,
            triageTier,
            segMaskPath,
            scanId,
          ]
        );

        // Create notification for the patient
        const [patients] = await db.query('SELECT user_id FROM PatientProfiles WHERE id = ?', [patientProfileId]);
        if (patients.length > 0) {
          await db.query(
            'INSERT INTO Notifications (id, user_id, type, message, reference_id) VALUES (UUID(), ?, ?, ?, ?)',
            [patients[0].user_id, 'scan_completed', `Your MRI scan analysis is complete: ${ai.tumor_type} detected.`, scanId]
          );
        }

        console.log(`[AI] Scan ${scanId} fully processed and saved to DB.`);
      } catch (aiErr) {
        console.error(`[AI] Pipeline failed for scan ${scanId}:`, aiErr.message);
        await db.query("UPDATE Scans SET status = 'failed' WHERE id = ?", [scanId]);
      }
    })();

    res.status(201).json({ scanId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// IMPORTANT: /history/me MUST come before /:id to avoid Express matching "history" as an ID
// @route   GET /api/scans/history/me
router.get('/history/me', protect, async (req, res) => {
  try {
    const [profiles] = await db.query('SELECT id FROM PatientProfiles WHERE user_id = ?', [req.user.id]);
    if (profiles.length === 0) return res.json([]);

    const [scans] = await db.query('SELECT * FROM Scans WHERE patient_id = ? ORDER BY created_at DESC', [profiles[0].id]);
    
    const formatted = scans.map(scan => ({
      id: scan.id,
      _id: scan.id,
      created_at: scan.created_at,
      uploadDate: scan.created_at,
      status: scan.status,
      triage_tier: scan.triage_tier,
      tumor_type: scan.tumor_type,
      results: {
        classification: scan.tumor_type || 'Processing',
        confidence: scan.classification_confidence ? scan.classification_confidence * 100 : 0
      }
    }));

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/scans/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const [scans] = await db.query('SELECT * FROM Scans WHERE id = ?', [req.params.id]);
    if (scans.length === 0) return res.status(404).json({ message: 'Scan not found' });
    const scan = scans[0];

    const formattedData = {
      _id: scan.id,
      uploadDate: scan.created_at,
      image_url: scan.mri_file_path ? `http://127.0.0.1:5000${scan.mri_file_path}` : null,
      segmentation_mask_url: scan.segmentation_mask_path ? `http://127.0.0.1:5000${scan.segmentation_mask_path}` : null,
      results: {
        classification: scan.tumor_type,
        confidence: scan.classification_confidence ? scan.classification_confidence * 100 : 0,
        location: scan.tumor_location,
        area: scan.tumor_size_mm2,
        hemisphere: scan.hemisphere,
        diameter: 39.7,
        treatmentSuggestion: scan.treatment_plan,
        urgencyScore: parseInt(scan.urgency_level) || 0,
        triageTier: {
          level: scan.triage_tier === 'emergency' ? 1 : scan.triage_tier === 'urgent' ? 2 : 3,
          label: scan.triage_tier,
          color: scan.triage_tier === 'emergency' ? '#ef4444' : scan.triage_tier === 'urgent' ? '#f59e0b' : '#10b981'
        }
      }
    };

    res.json(formattedData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/scans/:id/share
router.post('/:id/share', protect, async (req, res) => {
  try {
    const [scans] = await db.query('SELECT id, patient_id FROM Scans WHERE id = ?', [req.params.id]);
    if (scans.length === 0) return res.status(404).json({ message: 'Scan not found' });
    
    // Validate ownership
    const [profiles] = await db.query('SELECT id FROM PatientProfiles WHERE user_id = ?', [req.user.id]);
    if (profiles.length === 0 || scans[0].patient_id !== profiles[0].id) {
      return res.status(403).json({ message: 'Not authorized to share this scan' });
    }

    const crypto = require('crypto');
    const shareToken = crypto.randomBytes(32).toString('hex');

    await db.query('UPDATE Scans SET share_token = ? WHERE id = ?', [shareToken, req.params.id]);
    res.json({ share_token: shareToken, url: `/shared/${shareToken}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/scans/shared/:token
router.get('/shared/:token', async (req, res) => {
  try {
    const [scans] = await db.query('SELECT * FROM Scans WHERE share_token = ?', [req.params.token]);
    if (scans.length === 0) return res.status(404).json({ message: 'Invalid or expired share token' });
    
    const scan = scans[0];
    res.json({
      id: scan.id,
      created_at: scan.created_at,
      original_image_path: scan.mri_file_path,
      segmentation_mask_path: scan.segmentation_mask_path,
      tumor_type: scan.tumor_type,
      tumor_location: scan.tumor_location,
      classification_confidence: scan.classification_confidence,
      tumor_size_mm2: scan.tumor_size_mm2,
      hemisphere: scan.hemisphere,
      treatment_plan: scan.treatment_plan,
      triage_tier: scan.triage_tier,
      urgency_level: scan.urgency_level
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
