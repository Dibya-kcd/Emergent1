import { create } from 'zustand';
import { KOTBatch } from '../types';
import api from '../utils/api';

interface KOTState {
  kots: KOTBatch[];
  loading: boolean;
  fetchKOTs: () => Promise<void>;
  createKOT: (kot: KOTBatch) => Promise<void>;
  updateKOT: (id: string, kot: KOTBatch) => Promise<void>;
}

export const useKOTStore = create<KOTState>((set, get) => ({
  kots: [],
  loading: false,
  fetchKOTs: async () => {
    try {
      set({ loading: true });
      const response = await api.get('/kot');
      set({ kots: response.data, loading: false });
    } catch (error) {
      console.error('Fetch KOTs error:', error);
      set({ loading: false });
    }
  },
  createKOT: async (kot: KOTBatch) => {
    try {
      const response = await api.post('/kot', kot);
      set({ kots: [...get().kots, response.data] });
    } catch (error) {
      console.error('Create KOT error:', error);
      throw error;
    }
  },
  updateKOT: async (id: string, kot: KOTBatch) => {
    try {
      const response = await api.put(`/kot/${id}`, kot);
      set({
        kots: get().kots.map((k) => (k._id === id ? response.data : k)),
      });
    } catch (error) {
      console.error('Update KOT error:', error);
      throw error;
    }
  },
}));
