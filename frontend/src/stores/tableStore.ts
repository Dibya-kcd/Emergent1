import { create } from 'zustand';
import { Table } from '../types';
import api from '../utils/api';

interface TableState {
  tables: Table[];
  loading: boolean;
  fetchTables: () => Promise<void>;
  updateTable: (id: string, table: Partial<Table>) => Promise<void>;
}

export const useTableStore = create<TableState>((set, get) => ({
  tables: [],
  loading: false,
  fetchTables: async () => {
    try {
      set({ loading: true });
      const response = await api.get('/tables');
      set({ tables: response.data, loading: false });
    } catch (error) {
      console.error('Fetch tables error:', error);
      set({ loading: false });
    }
  },
  updateTable: async (id: string, table: Partial<Table>) => {
    try {
      const response = await api.put(`/tables/${id}`, table);
      set({
        tables: get().tables.map((t) => (t._id === id ? response.data : t)),
      });
    } catch (error) {
      console.error('Update table error:', error);
      throw error;
    }
  },
}));
