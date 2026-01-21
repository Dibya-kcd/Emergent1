import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

interface PendingOperation {
  id: string;
  type: 'create' | 'update' | 'delete';
  endpoint: string;
  data?: any;
  timestamp: number;
}

class OfflineManager {
  private QUEUE_KEY = '@resto_offline_queue';
  private DATA_CACHE_KEY = '@resto_data_cache';
  private isOnline = true;
  private syncInProgress = false;

  async init() {
    // Check connectivity
    this.checkConnectivity();
    
    // Set up periodic sync
    setInterval(() => this.syncPendingOperations(), 30000); // Every 30 seconds
  }

  async checkConnectivity(): Promise<boolean> {
    try {
      await api.get('/');
      this.isOnline = true;
      return true;
    } catch (error) {
      this.isOnline = false;
      return false;
    }
  }

  async addToQueue(operation: Omit<PendingOperation, 'id' | 'timestamp'>) {
    const queue = await this.getQueue();
    const newOperation: PendingOperation = {
      ...operation,
      id: `${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
    };
    queue.push(newOperation);
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(queue));
    
    // Try to sync immediately if online
    if (this.isOnline) {
      this.syncPendingOperations();
    }
  }

  async getQueue(): Promise<PendingOperation[]> {
    try {
      const queueJson = await AsyncStorage.getItem(this.QUEUE_KEY);
      return queueJson ? JSON.parse(queueJson) : [];
    } catch (error) {
      console.error('Error getting queue:', error);
      return [];
    }
  }

  async syncPendingOperations() {
    if (this.syncInProgress || !this.isOnline) return;

    this.syncInProgress = true;
    const queue = await this.getQueue();

    const successfulOps: string[] = [];

    for (const operation of queue) {
      try {
        switch (operation.type) {
          case 'create':
            await api.post(operation.endpoint, operation.data);
            break;
          case 'update':
            await api.put(operation.endpoint, operation.data);
            break;
          case 'delete':
            await api.delete(operation.endpoint);
            break;
        }
        successfulOps.push(operation.id);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);
      }
    }

    // Remove successful operations from queue
    if (successfulOps.length > 0) {
      const remainingQueue = queue.filter(op => !successfulOps.includes(op.id));
      await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(remainingQueue));
    }

    this.syncInProgress = false;
  }

  async cacheData(key: string, data: any) {
    try {
      await AsyncStorage.setItem(`${this.DATA_CACHE_KEY}_${key}`, JSON.stringify(data));
    } catch (error) {
      console.error('Error caching data:', error);
    }
  }

  async getCachedData(key: string): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(`${this.DATA_CACHE_KEY}_${key}`);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting cached data:', error);
      return null;
    }
  }

  async clearCache() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith(this.DATA_CACHE_KEY));
      await AsyncStorage.multiRemove(cacheKeys);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }
}

export default new OfflineManager();
