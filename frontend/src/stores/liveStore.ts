import { create } from 'zustand';
import io, { Socket } from 'socket.io-client';
import api from '../utils/api';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_BACKEND_URL;

interface LiveState {
  socket: Socket | null;
  connected: boolean;
  activeOrders: any[];
  pendingKOTs: any[];
  occupiedTables: any[];
  todayStats: {
    totalOrders: number;
    revenue: number;
    averageOrder: number;
  };
  connect: () => void;
  disconnect: () => void;
  fetchLiveDashboard: () => Promise<void>;
  subscribeToOrders: () => void;
  subscribeToKitchen: () => void;
}

export const useLiveStore = create<LiveState>((set, get) => ({
  socket: null,
  connected: false,
  activeOrders: [],
  pendingKOTs: [],
  occupiedTables: [],
  todayStats: {
    totalOrders: 0,
    revenue: 0,
    averageOrder: 0,
  },

  connect: () => {
    const socket = io(API_URL!, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      set({ connected: true });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      set({ connected: false });
    });

    socket.on('order_updated', (order) => {
      console.log('Order updated:', order);
      get().fetchLiveDashboard();
    });

    socket.on('kot_updated', (kot) => {
      console.log('KOT updated:', kot);
      get().fetchLiveDashboard();
    });

    socket.on('table_updated', (table) => {
      console.log('Table updated:', table);
      get().fetchLiveDashboard();
    });

    set({ socket });
  },

  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false });
    }
  },

  subscribeToOrders: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('subscribe_orders');
    }
  },

  subscribeToKitchen: () => {
    const { socket } = get();
    if (socket) {
      socket.emit('subscribe_kitchen');
    }
  },

  fetchLiveDashboard: async () => {
    try {
      const response = await api.get('/dashboard/live');
      set({
        activeOrders: response.data.activeOrders,
        pendingKOTs: response.data.pendingKOTs,
        occupiedTables: response.data.occupiedTables,
        todayStats: response.data.todayStats,
      });
    } catch (error) {
      console.error('Fetch live dashboard error:', error);
    }
  },
}));
