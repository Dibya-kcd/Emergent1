import { create } from 'zustand';
import { Order, OrderItem } from '../types';
import api from '../utils/api';

interface OrderState {
  orders: Order[];
  currentOrder: Order | null;
  loading: boolean;
  fetchOrders: () => Promise<void>;
  createOrder: (order: Order) => Promise<Order>;
  updateOrder: (id: string, order: Order) => Promise<void>;
  deleteOrder: (id: string) => Promise<void>;
  setCurrentOrder: (order: Order | null) => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  currentOrder: null,
  loading: false,
  fetchOrders: async () => {
    try {
      set({ loading: true });
      const response = await api.get('/orders');
      set({ orders: response.data, loading: false });
    } catch (error) {
      console.error('Fetch orders error:', error);
      set({ loading: false });
    }
  },
  createOrder: async (order: Order) => {
    try {
      const response = await api.post('/orders', order);
      set({ orders: [...get().orders, response.data] });
      return response.data;
    } catch (error) {
      console.error('Create order error:', error);
      throw error;
    }
  },
  updateOrder: async (id: string, order: Order) => {
    try {
      const response = await api.put(`/orders/${id}`, order);
      set({
        orders: get().orders.map((o) => (o._id === id ? response.data : o)),
      });
    } catch (error) {
      console.error('Update order error:', error);
      throw error;
    }
  },
  deleteOrder: async (id: string) => {
    try {
      await api.delete(`/orders/${id}`);
      set({ orders: get().orders.filter((o) => o._id !== id) });
    } catch (error) {
      console.error('Delete order error:', error);
      throw error;
    }
  },
  setCurrentOrder: (order: Order | null) => {
    set({ currentOrder: order });
  },
}));
