import { Platform, PermissionsAndroid, Alert } from 'react-native';

// Interfaces
interface PrinterDevice {
  id: string;
  name: string;
  address: string;
  type: 'BLE' | 'Classic';
}

interface SavedPrinter extends PrinterDevice {
  role: 'KOT' | 'Bill' | 'Both';
  isDefault: boolean;
  lastConnected?: Date;
}

class ThermalPrinterService {
  private BluetoothManager: any = null;
  private BluetoothEscposPrinter: any = null;
  private isInitialized: boolean = false;
  private connectedPrinters: Map<string, any> = new Map();

  constructor() {
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      try {
        // Import both Classic and BLE support
        const BluetoothModule = require('react-native-bluetooth-escpos-printer');
        this.BluetoothManager = BluetoothModule.BluetoothManager;
        this.BluetoothEscposPrinter = BluetoothModule.BluetoothEscposPrinter;
        this.isInitialized = true;
      } catch (error) {
        console.warn('Bluetooth printer module not available:', error);
        this.isInitialized = false;
      }
    }
  }

  private checkAvailability(): boolean {
    if (!this.isInitialized) {
      if (Platform.OS === 'web') {
        Alert.alert(
          'Not Available on Web',
          'Bluetooth printing is only available on mobile devices. Please use the Expo Go app or a native build.'
        );
      } else {
        Alert.alert(
          'Bluetooth Not Available',
          'Bluetooth printer module is not properly installed.'
        );
      }
      return false;
    }
    return true;
  }

  // Request Bluetooth permissions (Android)
  async requestPermissions(): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    if (Platform.OS === 'android') {
      try {
        const apiLevel = Platform.Version;
        
        // Android 12+ requires new Bluetooth permissions
        if (apiLevel >= 31) {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          return (
            granted['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          );
        } else {
          // Android 11 and below
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.BLUETOOTH,
            PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADMIN,
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          ]);

          return (
            granted['android.permission.BLUETOOTH'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.BLUETOOTH_ADMIN'] === PermissionsAndroid.RESULTS.GRANTED &&
            granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
          );
        }
      } catch (err) {
        console.warn('Permission request error:', err);
        return false;
      }
    }
    
    return true; // iOS doesn't need explicit permission requests
  }

  // Enable Bluetooth
  async enableBluetooth(): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    try {
      await this.BluetoothManager.enableBluetooth();
      return true;
    } catch (error) {
      console.error('Enable Bluetooth error:', error);
      return false;
    }
  }

  // Check if Bluetooth is enabled
  async isBluetoothEnabled(): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    try {
      return await this.BluetoothManager.isBluetoothEnabled();
    } catch (error) {
      console.error('Check Bluetooth error:', error);
      return false;
    }
  }

  // Scan for Classic Bluetooth printers
  async scanClassicPrinters(): Promise<PrinterDevice[]> {
    if (!this.checkAvailability()) return [];

    try {
      const hasPermissions = await this.requestPermissions();
      if (!hasPermissions) {
        Alert.alert('Permissions Required', 'Please grant Bluetooth permissions to scan for printers.');
        return [];
      }

      const isEnabled = await this.isBluetoothEnabled();
      if (!isEnabled) {
        const enabled = await this.enableBluetooth();
        if (!enabled) {
          Alert.alert('Bluetooth Disabled', 'Please enable Bluetooth to scan for printers.');
          return [];
        }
      }

      const pairedDevices = await this.BluetoothManager.list();
      
      return pairedDevices
        .filter((device: any) => 
          device.name && 
          (device.name.toLowerCase().includes('printer') ||
           device.name.toLowerCase().includes('pos') ||
           device.name.toLowerCase().includes('rpp') ||
           device.name.toLowerCase().includes('thermal'))
        )
        .map((device: any) => ({
          id: device.address,
          name: device.name,
          address: device.address,
          type: 'Classic' as const,
        }));
    } catch (error) {
      console.error('Scan Classic Bluetooth error:', error);
      Alert.alert('Scan Error', 'Failed to scan for Classic Bluetooth printers.');
      return [];
    }
  }

  // Connect to a printer
  async connectToPrinter(printer: PrinterDevice): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    try {
      if (printer.type === 'Classic') {
        await this.BluetoothManager.connect(printer.address);
        this.connectedPrinters.set(printer.id, { printer, connectedAt: new Date() });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Connect printer error:', error);
      Alert.alert('Connection Error', `Failed to connect to ${printer.name}`);
      return false;
    }
  }

  // Disconnect from a printer
  async disconnectPrinter(printerId: string): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    try {
      await this.BluetoothManager.disconnect();
      this.connectedPrinters.delete(printerId);
      return true;
    } catch (error) {
      console.error('Disconnect printer error:', error);
      return false;
    }
  }

  // Check if printer is connected
  isConnected(printerId: string): boolean {
    return this.connectedPrinters.has(printerId);
  }

  // Get connected printer info
  getConnectedPrinter(printerId: string): any {
    return this.connectedPrinters.get(printerId);
  }

  // Print KOT (Kitchen Order Ticket)
  async printKOT(order: any, printer: SavedPrinter): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    try {
      // Connect if not already connected
      if (!this.isConnected(printer.id)) {
        const connected = await this.connectToPrinter(printer);
        if (!connected) return false;
      }

      // Start printing
      await this.BluetoothEscposPrinter.printerInit();
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.CENTER);
      
      // Header
      await this.BluetoothEscposPrinter.setBlob(0);
      await this.BluetoothEscposPrinter.printText('================================\n', {});
      await this.BluetoothEscposPrinter.setBlob(1); // Bold
      await this.BluetoothEscposPrinter.printText('KITCHEN ORDER TICKET\n', {});
      await this.BluetoothEscposPrinter.setBlob(0);
      await this.BluetoothEscposPrinter.printText('================================\n', {});
      
      // Order details
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.LEFT);
      
      if (order.orderType === 'dine-in') {
        await this.BluetoothEscposPrinter.printText(`Table: ${order.tableNumber}\n`, {});
      } else {
        await this.BluetoothEscposPrinter.printText(`Takeout Token: #${order.tokenNumber}\n`, {});
      }
      
      await this.BluetoothEscposPrinter.printText(`Time: ${new Date().toLocaleTimeString()}\n`, {});
      await this.BluetoothEscposPrinter.printText('--------------------------------\n', {});
      
      // Items
      for (const item of order.items) {
        await this.BluetoothEscposPrinter.setBlob(1);
        await this.BluetoothEscposPrinter.printText(`${item.quantity}x ${item.name}\n`, {});
        await this.BluetoothEscposPrinter.setBlob(0);
        
        if (item.instructions) {
          await this.BluetoothEscposPrinter.printText(`   Note: ${item.instructions}\n`, {});
        }
      }
      
      await this.BluetoothEscposPrinter.printText('--------------------------------\n', {});
      await this.BluetoothEscposPrinter.printText(`\n\n`, {});
      
      // Cut paper
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.CENTER);
      await this.BluetoothEscposPrinter.printText('\n', {});
      
      return true;
    } catch (error) {
      console.error('Print KOT error:', error);
      Alert.alert('Print Error', 'Failed to print KOT. Please check printer connection.');
      return false;
    }
  }

  // Print Bill/Receipt
  async printBill(order: any, printer: SavedPrinter, settings: any): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    try {
      // Connect if not already connected
      if (!this.isConnected(printer.id)) {
        const connected = await this.connectToPrinter(printer);
        if (!connected) return false;
      }

      // Start printing
      await this.BluetoothEscposPrinter.printerInit();
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.CENTER);
      
      // Restaurant name
      await this.BluetoothEscposPrinter.setBlob(1);
      await this.BluetoothEscposPrinter.printText(`${settings.restaurantName || 'RestoPOS'}\n`, {});
      await this.BluetoothEscposPrinter.setBlob(0);
      await this.BluetoothEscposPrinter.printText('================================\n', {});
      
      // Bill details
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.LEFT);
      
      const billNo = order._id ? order._id.slice(-8).toUpperCase() : 'N/A';
      await this.BluetoothEscposPrinter.printText(`Bill No: ${billNo}\n`, {});
      
      if (order.orderType === 'dine-in') {
        await this.BluetoothEscposPrinter.printText(`Table: ${order.tableNumber}\n`, {});
      } else {
        await this.BluetoothEscposPrinter.printText(`Takeout: #${order.tokenNumber}\n`, {});
      }
      
      await this.BluetoothEscposPrinter.printText(`Date: ${new Date().toLocaleDateString()}\n`, {});
      await this.BluetoothEscposPrinter.printText(`Time: ${new Date().toLocaleTimeString()}\n`, {});
      await this.BluetoothEscposPrinter.printText('--------------------------------\n', {});
      
      // Items with prices
      await this.BluetoothEscposPrinter.printText('Item             Qty    Amount\n', {});
      await this.BluetoothEscposPrinter.printText('--------------------------------\n', {});
      
      for (const item of order.items) {
        const itemTotal = (item.price * item.quantity).toFixed(2);
        const itemName = item.name.length > 16 ? item.name.substring(0, 13) + '...' : item.name;
        const qty = item.quantity.toString();
        
        // Format line with proper spacing
        const line = `${itemName.padEnd(17)}${qty.padStart(3)}  ${(settings.currency || '₹')}${itemTotal.padStart(6)}\n`;
        await this.BluetoothEscposPrinter.printText(line, {});
      }
      
      await this.BluetoothEscposPrinter.printText('--------------------------------\n', {});
      
      // Totals
      const currency = settings.currency || '₹';
      await this.BluetoothEscposPrinter.printText(`Subtotal:              ${currency}${order.subtotal.toFixed(2)}\n`, {});
      await this.BluetoothEscposPrinter.printText(`Tax (${(settings.taxRate * 100).toFixed(0)}%):                ${currency}${order.tax.toFixed(2)}\n`, {});
      await this.BluetoothEscposPrinter.printText('--------------------------------\n', {});
      
      await this.BluetoothEscposPrinter.setBlob(1);
      await this.BluetoothEscposPrinter.printText(`TOTAL:                 ${currency}${order.total.toFixed(2)}\n`, {});
      await this.BluetoothEscposPrinter.setBlob(0);
      
      if (order.paymentMethod) {
        await this.BluetoothEscposPrinter.printText(`Payment: ${order.paymentMethod}\n`, {});
      }
      
      await this.BluetoothEscposPrinter.printText('--------------------------------\n', {});
      
      // Footer
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.CENTER);
      await this.BluetoothEscposPrinter.printText('Thank you for your visit!\n', {});
      await this.BluetoothEscposPrinter.printText('Please visit again\n', {});
      await this.BluetoothEscposPrinter.printText('\n\n\n', {});
      
      return true;
    } catch (error) {
      console.error('Print Bill error:', error);
      Alert.alert('Print Error', 'Failed to print bill. Please check printer connection.');
      return false;
    }
  }

  // Test print
  async testPrint(printer: SavedPrinter): Promise<boolean> {
    if (!this.checkAvailability()) return false;

    try {
      // Connect if not already connected
      if (!this.isConnected(printer.id)) {
        const connected = await this.connectToPrinter(printer);
        if (!connected) return false;
      }

      await this.BluetoothEscposPrinter.printerInit();
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.CENTER);
      
      await this.BluetoothEscposPrinter.setBlob(1);
      await this.BluetoothEscposPrinter.printText('RestoPOS\n', {});
      await this.BluetoothEscposPrinter.setBlob(0);
      await this.BluetoothEscposPrinter.printText('================================\n', {});
      await this.BluetoothEscposPrinter.printText('TEST PRINT SUCCESSFUL\n', {});
      await this.BluetoothEscposPrinter.printText('================================\n', {});
      await this.BluetoothEscposPrinter.printerAlign(this.BluetoothEscposPrinter.ALIGN.LEFT);
      await this.BluetoothEscposPrinter.printText(`Printer: ${printer.name}\n`, {});
      await this.BluetoothEscposPrinter.printText(`Role: ${printer.role}\n`, {});
      await this.BluetoothEscposPrinter.printText(`Type: ${printer.type} Bluetooth\n`, {});
      await this.BluetoothEscposPrinter.printText(`Date: ${new Date().toLocaleString()}\n`, {});
      await this.BluetoothEscposPrinter.printText('\n\n\n', {});
      
      Alert.alert('Success', 'Test print completed successfully!');
      return true;
    } catch (error) {
      console.error('Test print error:', error);
      Alert.alert('Print Error', 'Failed to test print. Please check printer connection.');
      return false;
    }
  }
}

export default new ThermalPrinterService();
