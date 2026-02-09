// User types
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  avatar?: string;
  isOnline?: boolean;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

// Auth types
export interface AuthResponse {
  user: User;
  token: string;
}

// API Response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
