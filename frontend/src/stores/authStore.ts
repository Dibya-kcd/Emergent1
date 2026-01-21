import { create } from 'zustand';
import { Employee } from '../types';
import api from '../utils/api';

interface AuthState {
  user: Employee | null;
  isAuthenticated: boolean;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  login: async (pin: string) => {
    try {
      const response = await api.post('/auth/login', { pin });
      set({ user: response.data, isAuthenticated: true });
      return true;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },
  logout: () => {
    set({ user: null, isAuthenticated: false });
  },
}));
