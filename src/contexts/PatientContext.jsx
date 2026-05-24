import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const PatientContext = createContext();

export function usePatientContext() {
  return useContext(PatientContext);
}

export function PatientProvider({ children }) {
  const { user } = useAuth();
  const [intakeData, setIntakeData] = useState({
    age: '',
    gender: '',
    smoking_status: 'Never',
    diabetes: false,
    hypertension: false,
    prior_cancer: false,
    prior_brain_surgery: false,
    immunosuppressed: false,
    seizures: false,
    headache_severity: 5,
    symptom_duration_weeks: '',
    functional_status: 'Independent',
    neurological_symptoms: 0
  });

  // Sync with database profile
  useEffect(() => {
    if (user && user.role === 'patient' && user.profile) {
      const p = user.profile;
      setIntakeData({
        age: p.age !== null && p.age !== undefined ? p.age : '',
        gender: p.gender || '',
        smoking_status: p.smoking_status || 'Never',
        diabetes: p.diabetes === 1,
        hypertension: p.hypertension === 1,
        prior_cancer: p.family_cancer_history === 1,
        prior_brain_surgery: p.previous_treatment === 1,
        immunosuppressed: p.immunosuppressed === 1,
        seizures: p.seizure_history === 1,
        headache_severity: p.headache_severity || 5,
        symptom_duration_weeks: p.symptom_duration_weeks !== null && p.symptom_duration_weeks !== undefined ? p.symptom_duration_weeks : '',
        functional_status: p.functional_status === 'needs_some_help' ? 'Some help' : 
                           p.functional_status === 'needs_significant_help' ? 'Significant help' : 
                           p.functional_status === 'fully_dependent' ? 'Bed-bound' : 'Independent',
        neurological_symptoms: p.neurological_symptoms === 'mild' ? 1 : 
                               p.neurological_symptoms === 'moderate' ? 2 : 
                               p.neurological_symptoms === 'severe' ? 3 : 0
      });
    }
  }, [user]);

  const [currentScan, setCurrentScan] = useState(null); // Will hold the image data URL
  
  const [analysisResults, setAnalysisResults] = useState(null);

  const updateIntakeData = (data) => {
    setIntakeData(data);
  };

  const uploadScan = (imageData) => {
    setCurrentScan(imageData);
  };

  const setResults = (results) => {
    setAnalysisResults(results);
  };

  const resetFlow = () => {
    setIntakeData({
      age: '',
      gender: '',
      smoking_status: 'Never',
      diabetes: false,
      hypertension: false,
      prior_cancer: false,
      prior_brain_surgery: false,
      immunosuppressed: false,
      seizures: false,
      headache_severity: 5,
      symptom_duration_weeks: '',
      functional_status: 'Independent',
      neurological_symptoms: 0
    });
    setCurrentScan(null);
    setAnalysisResults(null);
  };

  const value = {
    intakeData,
    updateIntakeData,
    currentScan,
    uploadScan,
    analysisResults,
    setResults,
    resetFlow
  };

  return (
    <PatientContext.Provider value={value}>
      {children}
    </PatientContext.Provider>
  );
}
