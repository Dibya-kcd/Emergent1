import { create } from 'zustand';
import { MenuItem } from '../types';
import api from '../utils/api';

interface MenuState {
  items: MenuItem[];
  loading: boolean;
  fetchMenu: () => Promise<void>;
  addItem: (item: MenuItem) => Promise<void>;
  updateItem: (id: string, item: MenuItem) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
}

export const useMenuStore = create<MenuState>((set, get) => ({
  items: [],
  loading: false,
  fetchMenu: async () => {
    try {
      set({ loading: true });
      const response = await api.get('/menu');
      set({ items: response.data, loading: false });
    } catch (error) {
      console.error('Fetch menu error:', error);
      set({ loading: false });
    }
  },
  addItem: async (item: MenuItem) => {
    try {
      const response = await api.post('/menu', item);
      set({ items: [...get().items, response.data] });
    } catch (error) {
      console.error('Add item error:', error);
      throw error;
    }
  },
  updateItem: async (id: string, item: MenuItem) => {
    try {
      const response = await api.put(`/menu/${id}`, item);
      set({
        items: get().items.map((i) => (i._id === id ? response.data : i)),
      });
    } catch (error) {
      console.error('Update item error:', error);
      throw error;
    }
  },
  deleteItem: async (id: string) => {
    try {
      await api.delete(`/menu/${id}`);
      set({ items: get().items.filter((i) => i._id !== id) });
    } catch (error) {
      console.error('Delete item error:', error);
      throw error;
    }
  },
}));
