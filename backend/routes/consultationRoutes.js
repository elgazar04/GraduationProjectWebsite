const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// @route   POST /api/consultations
// @desc    Patient books a consultation
router.post('/', protect, async (req, res) => {
  const { scan_id, doctor_id, date, time } = req.body;
  try {
    const [profiles] = await db.query('SELECT id FROM PatientProfiles WHERE user_id = ?', [req.user.id]);
    if (profiles.length === 0) return res.status(403).json({ message: 'Only patients can book consultations' });
    const patient_id = profiles[0].id;

    const consultId = uuidv4();
    const meeting_time = new Date(`${date}T${time}:00`).toISOString().slice(0, 19).replace('T', ' ');
    
    await db.query(
      'INSERT INTO Consultations (id, scan_id, patient_id, doctor_id, meeting_time, status) VALUES (?, ?, ?, ?, ?, ?)',
      [consultId, scan_id, patient_id, doctor_id, meeting_time, 'pending']
    );

    res.status(201).json({ message: 'Consultation booked successfully', id: consultId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/consultations/me
// @desc    Get consultations for current user (Doctor or Patient)
router.get('/me', protect, async (req, res) => {
  try {
    let query = '';
    let params = [];

    if (req.user.role === 'patient') {
      const [profiles] = await db.query('SELECT id FROM PatientProfiles WHERE user_id = ?', [req.user.id]);
      query = `SELECT c.*, d.specialization, u.name as doctor_name 
               FROM Consultations c 
               JOIN DoctorProfiles d ON c.doctor_id = d.id 
               JOIN Users u ON d.user_id = u.id 
               WHERE c.patient_id = ? ORDER BY c.created_at DESC`;
      params = [profiles[0].id];
    } else if (req.user.role === 'doctor') {
      const [profiles] = await db.query('SELECT id FROM DoctorProfiles WHERE user_id = ?', [req.user.id]);
      query = `SELECT c.*, u.name as patient_name, s.mri_file_path, s.tumor_type 
               FROM Consultations c 
               JOIN PatientProfiles p ON c.patient_id = p.id 
               JOIN Users u ON p.user_id = u.id 
               JOIN Scans s ON c.scan_id = s.id
               WHERE c.doctor_id = ? ORDER BY c.created_at DESC`;
      params = [profiles[0].id];
    } else {
      return res.status(403).json({ message: 'Admins do not have consultations' });
    }

    const [consultations] = await db.query(query, params);
    res.json(consultations);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/consultations/:id
// @desc    Get a single consultation by ID
router.get('/:id', protect, async (req, res) => {
  try {
    const [consults] = await db.query(`
      SELECT c.*, 
             s.mri_file_path as original_image_path, s.segmentation_mask_path, s.tumor_type, 
             s.tumor_location, s.tumor_size_mm2, s.classification_confidence, 
             s.treatment_plan, s.urgency_level, s.triage_tier,
             u.name as patient_name, u.email as patient_email,
             p.age, p.gender, p.family_cancer_history, p.previous_treatment, p.neurological_symptoms, p.headache_severity, p.functional_status, p.seizure_history, p.immunosuppressed, p.comorbidities
      FROM Consultations c
      JOIN Scans s ON c.scan_id = s.id
      JOIN PatientProfiles p ON c.patient_id = p.id
      JOIN Users u ON p.user_id = u.id
      WHERE c.id = ?
    `, [req.params.id]);

    if (consults.length === 0) return res.status(404).json({ message: 'Consultation not found' });
    
    // Authorization check
    if (req.user.role === 'patient') {
      const [profiles] = await db.query('SELECT id FROM PatientProfiles WHERE user_id = ?', [req.user.id]);
      if (profiles.length === 0 || consults[0].patient_id !== profiles[0].id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
    } else if (req.user.role === 'doctor') {
      const [profiles] = await db.query('SELECT id FROM DoctorProfiles WHERE user_id = ?', [req.user.id]);
      if (profiles.length === 0 || consults[0].doctor_id !== profiles[0].id) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
    }

    res.json(consults[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/consultations/:id/notes
// @desc    Doctor adds notes and overrides AI
router.put('/:id/notes', protect, async (req, res) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ message: 'Only doctors can add clinical notes' });
  const { ai_agreement, clinical_notes, alternative_recommendation } = req.body;

  try {
    const [profiles] = await db.query('SELECT id FROM DoctorProfiles WHERE user_id = ?', [req.user.id]);
    
    const [result] = await db.query(
      'UPDATE Consultations SET ai_agreement = ?, clinical_notes = ?, alternative_recommendation = ?, status = ? WHERE id = ? AND doctor_id = ?',
      [ai_agreement, clinical_notes, alternative_recommendation, 'completed', req.params.id, profiles[0].id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Consultation not found or unauthorized' });
    res.json({ message: 'Clinical review saved successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/consultations/:id/messages
// @desc    Send a chat message in a consultation
router.post('/:id/messages', protect, async (req, res) => {
  const { content } = req.body;
  if (!content) return res.status(400).json({ message: 'Message content required' });

  try {
    // Validate that user is part of the consultation
    const [consult] = await db.query('SELECT * FROM Consultations WHERE id = ?', [req.params.id]);
    if (consult.length === 0) return res.status(404).json({ message: 'Consultation not found' });

    const messageId = uuidv4();
    await db.query(
      'INSERT INTO Messages (id, consultation_id, sender_id, content) VALUES (?, ?, ?, ?)',
      [messageId, req.params.id, req.user.id, content]
    );

    res.status(201).json({ message: 'Message sent', id: messageId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/consultations/:id/messages
// @desc    Get all chat messages for a consultation
router.get('/:id/messages', protect, async (req, res) => {
  try {
    const [messages] = await db.query(
      'SELECT m.*, u.name as sender_name FROM Messages m JOIN Users u ON m.sender_id = u.id WHERE m.consultation_id = ? ORDER BY m.created_at ASC',
      [req.params.id]
    );
    res.json(messages);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/consultations/:id/rate
// @desc    Patient rates the doctor
router.post('/:id/rate', protect, async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients can rate doctors' });
  const { rating, review_text } = req.body;

  try {
    const [consults] = await db.query('SELECT * FROM Consultations WHERE id = ?', [req.params.id]);
    if (consults.length === 0) return res.status(404).json({ message: 'Consultation not found' });
    const consult = consults[0];

    const ratingId = uuidv4();
    await db.query(
      'INSERT INTO DoctorRatings (id, consultation_id, patient_id, doctor_id, rating, review_text) VALUES (?, ?, ?, ?, ?, ?)',
      [ratingId, req.params.id, consult.patient_id, consult.doctor_id, rating, review_text || null]
    );

    // Update doctor's average rating
    await db.query(`
      UPDATE DoctorProfiles SET average_rating = (
        SELECT AVG(rating) FROM DoctorRatings WHERE doctor_id = ?
      ) WHERE id = ?`,
      [consult.doctor_id, consult.doctor_id]
    );

    res.status(201).json({ message: 'Rating submitted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/consultations/:id/status
// @desc    Doctor accepts or declines a consultation
router.put('/:id/status', protect, async (req, res) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ message: 'Only doctors can change consultation status' });
  const { status } = req.body; // 'accepted', 'declined', 'in_progress'

  if (!['accepted', 'declined', 'in_progress'].includes(status)) {
    return res.status(400).json({ message: 'Invalid status' });
  }

  try {
    const [profiles] = await db.query('SELECT id FROM DoctorProfiles WHERE user_id = ?', [req.user.id]);
    
    const [result] = await db.query(
      'UPDATE Consultations SET status = ? WHERE id = ? AND doctor_id = ?',
      [status, req.params.id, profiles[0].id]
    );

    if (result.affectedRows === 0) return res.status(404).json({ message: 'Consultation not found or unauthorized' });
    
    // Add Notification to patient (optional enhancement based on diagram)
    const [consults] = await db.query('SELECT patient_id FROM Consultations WHERE id = ?', [req.params.id]);
    if (consults.length > 0) {
      const [patients] = await db.query('SELECT user_id FROM PatientProfiles WHERE id = ?', [consults[0].patient_id]);
      if (patients.length > 0) {
        const notifType = status === 'accepted' ? 'consultation_accepted' : status === 'declined' ? 'consultation_declined' : 'consultation_requested';
        await db.query(
          'INSERT INTO Notifications (id, user_id, type, message, reference_id) VALUES (UUID(), ?, ?, ?, ?)',
          [patients[0].user_id, notifType, `Your consultation was ${status}.`, req.params.id]
        );
      }
    }

    res.json({ message: `Consultation marked as ${status}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
