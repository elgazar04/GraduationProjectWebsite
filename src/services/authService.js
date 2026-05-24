const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

// Helper to handle API responses
const handleResponse = async (response) => {
  const data = await response.json();
  if (!response.ok) {
    const error = (data && data.message) || response.statusText;
    throw new Error(error);
  }
  return data;
};

// Helper to get auth headers
const authHeader = () => {
  const token = localStorage.getItem('token');
  if (token) {
    return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
};

export const authService = {
  // Patient Registration
  register: async (userData) => {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return handleResponse(response);
  },

  // Doctor Registration
  registerDoctor: async (doctorData) => {
    const response = await fetch(`${API_URL}/auth/register/doctor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doctorData)
    });
    return handleResponse(response);
  },

  // Login
  login: async (credentials) => {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await handleResponse(response);
    if (data.token) localStorage.setItem('token', data.token);
    return data;
  },

  // Get Current User Profile
  getMe: async () => {
    const token = localStorage.getItem('token');
    if (!token) throw new Error('No token found');
    
    const response = await fetch(`${API_URL}/auth/me`, { headers: authHeader() });
    return handleResponse(response);
  },

  // Refresh Token
  refreshToken: async () => {
    // Basic mock fallback if needed, but a real server would have this endpoint
    return { token: localStorage.getItem('token') };
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }
};

