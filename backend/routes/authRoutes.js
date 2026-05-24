const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

// @route   POST /api/auth/register
// @desc    Register a new patient
router.post('/register', async (req, res) => {
  const { name, email, password, dob, phone } = req.body;
  try {
    const [existingUsers] = await db.query('SELECT id FROM Users WHERE email = ?', [email]);
    if (existingUsers.length > 0) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Let's generate UUID in node.
    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();

    // Insert into Users table (single insert)
    await db.query(
      'INSERT INTO Users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [userId, email, hashedPassword, name, 'patient']
    );

    // Insert into PatientProfiles table
    const patientProfileId = uuidv4();
    await db.query(
      'INSERT INTO PatientProfiles (id, user_id) VALUES (?, ?)',
      [patientProfileId, userId]
    );
    
    res.status(201).json({
      user: { id: userId, name, email, role: 'patient' },
      token: generateToken(userId, 'patient')
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/register/doctor
// @desc    Register a new doctor
router.post('/register/doctor', async (req, res) => {
  const { name, email, password, specialty, license } = req.body;
  try {
    const [existingUsers] = await db.query('SELECT id FROM Users WHERE email = ?', [email]);
    if (existingUsers.length > 0) return res.status(400).json({ message: 'User already exists' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { v4: uuidv4 } = require('uuid');
    const userId = uuidv4();
    
    await db.query(
      'INSERT INTO Users (id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [userId, email, hashedPassword, name, 'doctor']
    );

    const doctorProfileId = uuidv4();
    await db.query(
      'INSERT INTO DoctorProfiles (id, user_id, specialization, license_file_path) VALUES (?, ?, ?, ?)',
      [doctorProfileId, userId, specialty, license || 'pending_upload']
    );
    
    res.status(201).json({
      user: { id: userId, name, email, role: 'doctor' },
      token: generateToken(userId, 'doctor')
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const [users] = await db.query('SELECT * FROM Users WHERE email = ?', [email]);
    const user = users[0];
    
    if (user && (await bcrypt.compare(password, user.password_hash))) {
      res.json({
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
        token: generateToken(user.id, user.role)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const [users] = await db.query('SELECT id, email, name, role, is_active FROM Users WHERE id = ?', [req.user.id]);
    const user = users[0];
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    // Fetch related profile
    if (user.role === 'patient') {
      const [profiles] = await db.query('SELECT * FROM PatientProfiles WHERE user_id = ?', [user.id]);
      user.profile = profiles[0] || {};
    } else if (user.role === 'doctor') {
      const [profiles] = await db.query('SELECT * FROM DoctorProfiles WHERE user_id = ?', [user.id]);
      user.profile = profiles[0] || {};
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile/patient
router.put('/profile/patient', protect, async (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ message: 'Only patients can update this profile' });
  const { 
    name, age, gender, smoking_status, diabetes, hypertension,
    prior_cancer, prior_brain_surgery, immunosuppressed, seizures,
    headache_severity, symptom_duration_weeks, functional_status, neurological_symptoms
  } = req.body;
  
  const functionalStatusMap = {
    'Independent': 'independent',
    'Some help': 'needs_some_help',
    'Significant help': 'needs_significant_help',
    'Bed-bound': 'fully_dependent'
  };
  const dbFunctionalStatus = functionalStatusMap[functional_status] || 'independent';

  const neurologicalSymptomsMap = {
    0: 'none',
    1: 'mild',
    2: 'moderate',
    3: 'severe'
  };
  const dbNeurologicalSymptoms = neurologicalSymptomsMap[neurological_symptoms] || 'none';

  const comorbiditiesStr = `Diabetes: ${diabetes ? 'Yes' : 'No'}, Hypertension: ${hypertension ? 'Yes' : 'No'}`;

  try {
    // Update name in Users table
    if (name) {
      await db.query('UPDATE Users SET name = ? WHERE id = ?', [name, req.user.id]);
    }

    await db.query(
      `UPDATE PatientProfiles SET 
        age = ?, 
        gender = ?, 
        smoking_status = ?, 
        diabetes = ?, 
        hypertension = ?, 
        family_cancer_history = ?, 
        previous_treatment = ?, 
        immunosuppressed = ?, 
        seizure_history = ?, 
        headache_severity = ?, 
        symptom_duration_weeks = ?, 
        functional_status = ?, 
        neurological_symptoms = ?, 
        comorbidities = ? 
      WHERE user_id = ?`,
      [
        age || null,
        gender || null,
        smoking_status || 'Never',
        diabetes ? 1 : 0,
        hypertension ? 1 : 0,
        prior_cancer ? 1 : 0,
        prior_brain_surgery ? 1 : 0,
        immunosuppressed ? 1 : 0,
        seizures ? 1 : 0,
        headache_severity || 5,
        symptom_duration_weeks || 4,
        dbFunctionalStatus,
        dbNeurologicalSymptoms,
        comorbiditiesStr,
        req.user.id
      ]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/profile/doctor
router.put('/profile/doctor', protect, async (req, res) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ message: 'Only doctors can update this profile' });
  const { years_experience, license_file_path } = req.body;
  
  try {
    await db.query(
      'UPDATE DoctorProfiles SET years_experience = ?, license_file_path = ? WHERE user_id = ?',
      [years_experience, license_file_path, req.user.id]
    );
    res.json({ message: 'Profile updated' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   PUT /api/auth/reset-password
router.put('/reset-password', protect, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  try {
    const [users] = await db.query('SELECT password_hash FROM Users WHERE id = ?', [req.user.id]);
    const user = users[0];

    if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ message: 'Invalid current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await db.query('UPDATE Users SET password_hash = ? WHERE id = ?', [hashedPassword, req.user.id]);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   DELETE /api/auth/deactivate
router.delete('/deactivate', protect, async (req, res) => {
  try {
    await db.query('UPDATE Users SET is_active = false WHERE id = ?', [req.user.id]);
    res.json({ message: 'Account deactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
