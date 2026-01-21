export interface MenuItem {
  _id?: string;
  name: string;
  category: string;
  price: number;
  emoji?: string;
  image?: string;
  stock: number;
  soldOut: boolean;
  description?: string;
  modifiers?: any[];
  specialFlags?: string[];
  createdAt?: string;
}

export interface Table {
  _id?: string;
  tableNumber: number;
  capacity: number;
  status: 'available' | 'occupied' | 'preparing' | 'serving' | 'billing';
  currentOrder?: string;
  updatedAt?: string;
}

export interface OrderItem {
  menuItemId: string;
  name: string;
  quantity: number;
  price: number;
  modifiers?: string[];
  instructions?: string;
}

export interface Order {
  _id?: string;
  orderType: 'dine-in' | 'takeout';
  tableNumber?: number;
  tokenNumber?: number;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  subtotal: number;
  tax: number;
  total: number;
  paymentMethod?: string;
  paymentStatus: 'unpaid' | 'paid';
  kotSent: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface KOTBatch {
  _id?: string;
  orderId: string;
  orderType: string;
  tableNumber?: number;
  tokenNumber?: number;
  items: OrderItem[];
  status: 'pending' | 'preparing' | 'completed' | 'cancelled';
  createdAt?: string;
}

export interface Employee {
  _id?: string;
  name: string;
  role: string;
  pin: string;
  phone?: string;
  salary: number;
  photo?: string;
  createdAt?: string;
}

export interface Expense {
  _id?: string;
  category: string;
  amount: number;
  description?: string;
  date?: string;
}

export interface Inventory {
  _id?: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  minThreshold: number;
  updatedAt?: string;
}
