import axios from 'axios';
import type { User, AuthResponse, ApiResponse } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const { data } = await api.post<ApiResponse<AuthResponse>>('/auth/login', {
      email,
      password,
    });
    return data.data!;
  },

  getMe: async (): Promise<User> => {
    const { data } = await api.get<ApiResponse<User>>('/auth/me');
    return data.data!;
  },

  logout: async (): Promise<void> => {
    await api.post('/auth/logout');
  },
};

// Lead type for the CRM
export interface Lead {
  id: string;
  email: string;
  name?: string;
  phone?: string;
  solution: 'cavities' | 'whitening' | 'breath' | 'drill-free' | 'telehealth' | 'biotest';
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost';
  source?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Subscriber type
export interface Subscriber {
  id: string;
  email: string;
  name: string;
  plan: string;
  status: 'active' | 'paused' | 'cancelled';
  solution: string;
  startDate: string;
  nextBillingDate: string;
  monthlyAmount: number;
  totalSpent: number;
}

// Mock data for now - will be replaced with real API calls
export const adminApi = {
  // Get all subscribers
  getSubscribers: async (): Promise<Subscriber[]> => {
    // Mock data - replace with actual API call
    return [
      {
        id: 'sub-001',
        email: 'aubrey@example.com',
        name: 'Aubrey Lang',
        plan: 'Cavity Prevention',
        status: 'active',
        solution: 'cavities',
        startDate: '2025-11-15',
        nextBillingDate: '2026-02-15',
        monthlyAmount: 49,
        totalSpent: 147,
      },
      {
        id: 'sub-002',
        email: 'sarah@example.com',
        name: 'Sarah Mitchell',
        plan: 'Whitening System',
        status: 'active',
        solution: 'whitening',
        startDate: '2025-12-01',
        nextBillingDate: '2026-02-01',
        monthlyAmount: 49,
        totalSpent: 98,
      },
      {
        id: 'sub-003',
        email: 'james@example.com',
        name: 'James Wilson',
        plan: 'Fresh Breath Protocol',
        status: 'active',
        solution: 'breath',
        startDate: '2026-01-10',
        nextBillingDate: '2026-02-10',
        monthlyAmount: 49,
        totalSpent: 49,
      },
      {
        id: 'sub-004',
        email: 'emily@example.com',
        name: 'Emily Chen',
        plan: 'Cavity Prevention',
        status: 'paused',
        solution: 'cavities',
        startDate: '2025-10-20',
        nextBillingDate: '2026-03-20',
        monthlyAmount: 49,
        totalSpent: 147,
      },
      {
        id: 'sub-005',
        email: 'michael@example.com',
        name: 'Michael Torres',
        plan: 'Drill-Free Care',
        status: 'active',
        solution: 'drill-free',
        startDate: '2025-12-15',
        nextBillingDate: '2026-02-15',
        monthlyAmount: 49,
        totalSpent: 98,
      },
    ];
  },

  // Get all leads
  getLeads: async (): Promise<Lead[]> => {
    // Mock data - replace with actual API call
    return [
      {
        id: 'lead-001',
        email: 'john.d@gmail.com',
        name: 'John Davis',
        phone: '555-0101',
        solution: 'cavities',
        status: 'new',
        source: 'Quiz',
        createdAt: '2026-02-08T14:30:00Z',
        updatedAt: '2026-02-08T14:30:00Z',
      },
      {
        id: 'lead-002',
        email: 'lisa.m@yahoo.com',
        name: 'Lisa Martinez',
        solution: 'whitening',
        status: 'contacted',
        source: 'Quiz',
        notes: 'Interested in whitening, asked about pricing',
        createdAt: '2026-02-07T10:15:00Z',
        updatedAt: '2026-02-08T09:00:00Z',
      },
      {
        id: 'lead-003',
        email: 'robert.k@outlook.com',
        name: 'Robert Kim',
        phone: '555-0202',
        solution: 'breath',
        status: 'qualified',
        source: 'Telehealth Consult',
        notes: 'Has chronic bad breath issues, ready to start',
        createdAt: '2026-02-06T16:45:00Z',
        updatedAt: '2026-02-08T11:30:00Z',
      },
      {
        id: 'lead-004',
        email: 'amanda.w@gmail.com',
        name: 'Amanda White',
        solution: 'drill-free',
        status: 'new',
        source: 'Quiz',
        createdAt: '2026-02-08T08:20:00Z',
        updatedAt: '2026-02-08T08:20:00Z',
      },
      {
        id: 'lead-005',
        email: 'david.l@icloud.com',
        name: 'David Lee',
        phone: '555-0303',
        solution: 'telehealth',
        status: 'converted',
        source: 'Direct',
        notes: 'Converted to telehealth subscription',
        createdAt: '2026-02-01T12:00:00Z',
        updatedAt: '2026-02-05T15:00:00Z',
      },
      {
        id: 'lead-006',
        email: 'jennifer.b@gmail.com',
        name: 'Jennifer Brown',
        solution: 'biotest',
        status: 'contacted',
        source: 'Quiz',
        createdAt: '2026-02-07T14:00:00Z',
        updatedAt: '2026-02-08T10:00:00Z',
      },
      {
        id: 'lead-007',
        email: 'chris.p@yahoo.com',
        name: 'Chris Parker',
        solution: 'cavities',
        status: 'new',
        source: 'Quiz',
        createdAt: '2026-02-08T16:00:00Z',
        updatedAt: '2026-02-08T16:00:00Z',
      },
      {
        id: 'lead-008',
        email: 'nicole.h@gmail.com',
        name: 'Nicole Harris',
        phone: '555-0404',
        solution: 'whitening',
        status: 'qualified',
        source: 'Smile Simulator',
        notes: 'Used smile simulator, very interested',
        createdAt: '2026-02-06T09:30:00Z',
        updatedAt: '2026-02-08T14:00:00Z',
      },
      {
        id: 'lead-009',
        email: 'mark.t@outlook.com',
        name: 'Mark Thompson',
        solution: 'drill-free',
        status: 'lost',
        source: 'Quiz',
        notes: 'No dentist in their area',
        createdAt: '2026-02-03T11:00:00Z',
        updatedAt: '2026-02-07T09:00:00Z',
      },
      {
        id: 'lead-010',
        email: 'rachel.g@gmail.com',
        name: 'Rachel Green',
        solution: 'cavities',
        status: 'new',
        source: 'Quiz',
        createdAt: '2026-02-08T17:30:00Z',
        updatedAt: '2026-02-08T17:30:00Z',
      },
    ];
  },

  // Update lead status
  updateLeadStatus: async (id: string, status: Lead['status']): Promise<Lead> => {
    // Mock - replace with actual API call
    console.log(`Updating lead ${id} to status ${status}`);
    return {} as Lead;
  },

  // Get users (patients)
  getUsers: async (): Promise<User[]> => {
    const { data } = await api.get<ApiResponse<User[]>>('/admin/users');
    return data.data || [];
  },
};

export default api;
