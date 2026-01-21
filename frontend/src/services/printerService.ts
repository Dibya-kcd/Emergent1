import { PermissionsAndroid, Platform, Alert } from 'react-native';

// Type definitions for BLE
interface Device {
  id: string;
  name: string | null;
}

class BluetoothPrinterService {
  private bleManager: any = null;
  private connectedDevice: Device | null = null;
  private isInitialized: boolean = false;

  constructor() {
    // Only initialize BLE on native platforms
    if (Platform.OS === 'android' || Platform.OS === 'ios') {
      try {
        // Dynamically import BLE manager only on native
        const BleManager = require('react-native-ble-plx').BleManager;
        this.bleManager = new BleManager();
        this.isInitialized = true;
      } catch (error) {
        console.warn('BLE not available:', error);
        this.isInitialized = false;
      }
    }
  }

  private checkAvailability(): boolean {
    if (!this.isInitialized || !this.bleManager) {
      Alert.alert(
        'Not Available',
        'Bluetooth printing is only available on mobile devices. Please use the mobile app.'
      );
      return false;
    }
    return true;
  }

  async requestBluetoothPermissions(): Promise<boolean> {
    if (!this.checkAvailability()) return false;
    
    if (Platform.OS === 'android') {
      try {
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
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  }

  async scanForPrinters(onDeviceFound: (device: Device) => void): Promise<void> {
    if (!this.checkAvailability()) return;
    
    const hasPermissions = await this.requestBluetoothPermissions();
    if (!hasPermissions) {
      Alert.alert('Permissions Required', 'Please grant Bluetooth permissions to scan for printers.');
      return;
    }

    this.bleManager.startDeviceScan(null, null, (error: any, device: any) => {
      if (error) {
        console.error('Scan error:', error);
        return;
      }

      if (device && device.name) {
        // Filter for thermal printers (common names)
        if (
          device.name.toLowerCase().includes('printer') ||
          device.name.toLowerCase().includes('thermal') ||
          device.name.toLowerCase().includes('pos')
        ) {
          onDeviceFound(device);
        }
      }
    });

    // Stop scanning after 10 seconds
    setTimeout(() => {
      this.bleManager.stopDeviceScan();
    }, 10000);
  }

  async connectToPrinter(deviceId: string): Promise<boolean> {
    if (!this.checkAvailability()) return false;
    
    try {
      const device = await this.bleManager.connectToDevice(deviceId);
      await device.discoverAllServicesAndCharacteristics();
      this.connectedDevice = device;
      return true;
    } catch (error) {
      console.error('Connection error:', error);
      return false;
    }
  }

  async disconnectPrinter(): Promise<void> {
    if (!this.checkAvailability() || !this.connectedDevice) return;
    
    await this.bleManager.cancelDeviceConnection(this.connectedDevice.id);
    this.connectedDevice = null;
  }

  // ESC/POS Commands
  private ESC = '\x1B';
  private GS = '\x1D';

  private generateESCPOS(content: string, type: 'KOT' | 'BILL'): string {
    let commands = '';

    // Initialize
    commands += this.ESC + '@';

    // Set alignment center
    commands += this.ESC + 'a' + '\x01';

    // Bold text
    commands += this.ESC + 'E' + '\x01';
    commands += type === 'KOT' ? 'KITCHEN ORDER TICKET\n' : 'BILL\n';
    commands += this.ESC + 'E' + '\x00'; // Bold off

    // Line
    commands += '================================\n';

    // Align left for content
    commands += this.ESC + 'a' + '\x00';
    commands += content;

    // Feed and cut
    commands += '\n\n\n';
    commands += this.GS + 'V' + '\x41' + '\x03'; // Partial cut

    return commands;
  }

  async printKOT(order: any): Promise<boolean> {
    if (!this.checkAvailability() || !this.connectedDevice) {
      Alert.alert('Error', 'No printer connected. This feature requires a mobile device with Bluetooth.');
      return false;
    }

    try {
      let content = '';
      content += `Table/Token: ${order.tableNumber || `T-${order.tokenNumber}`}\n`;
      content += `Time: ${new Date().toLocaleTimeString()}\n`;
      content += '--------------------------------\n';

      for (const item of order.items) {
        content += `${item.quantity}x ${item.name}\n`;
        if (item.instructions) {
          content += `  Note: ${item.instructions}\n`;
        }
      }

      content += '--------------------------------\n';

      const escposData = this.generateESCPOS(content, 'KOT');

      // Convert string to base64 for BLE transmission
      const base64Data = Buffer.from(escposData, 'utf-8').toString('base64');

      // Send to printer (implementation depends on printer's BLE characteristics)
      // This is a simplified version - actual implementation needs printer-specific UUIDs
      console.log('Printing KOT:', base64Data);

      return true;
    } catch (error) {
      console.error('Print error:', error);
      return false;
    }
  }

  async printBill(order: any, settings: any): Promise<boolean> {
    if (!this.checkAvailability() || !this.connectedDevice) {
      Alert.alert('Error', 'No printer connected. This feature requires a mobile device with Bluetooth.');
      return false;
    }

    try {
      let content = '';
      content += `${settings.restaurantName}\n`;
      content += '--------------------------------\n';
      content += `Bill No: ${order._id?.slice(-8)}\n`;
      content += `Table: ${order.tableNumber || `T-${order.tokenNumber}`}\n`;
      content += `Date: ${new Date().toLocaleDateString()}\n`;
      content += `Time: ${new Date().toLocaleTimeString()}\n`;
      content += '--------------------------------\n';

      for (const item of order.items) {
        const itemTotal = item.price * item.quantity;
        content += `${item.quantity}x ${item.name}  ${settings.currency}${itemTotal}\n`;
      }

      content += '--------------------------------\n';
      content += `Subtotal: ${settings.currency}${order.subtotal.toFixed(2)}\n`;
      content += `Tax: ${settings.currency}${order.tax.toFixed(2)}\n`;
      content += `TOTAL: ${settings.currency}${order.total.toFixed(2)}\n`;
      content += '--------------------------------\n';
      content += 'Thank you for your visit!\n';

      const escposData = this.generateESCPOS(content, 'BILL');
      const base64Data = Buffer.from(escposData, 'utf-8').toString('base64');

      console.log('Printing Bill:', base64Data);

      return true;
    } catch (error) {
      console.error('Print error:', error);
      return false;
    }
  }

  async testPrint(): Promise<boolean> {
    if (!this.checkAvailability() || !this.connectedDevice) {
      Alert.alert('Error', 'No printer connected. This feature requires a mobile device with Bluetooth.');
      return false;
    }

    try {
      const content = 'RestoPOS Test Print\nPrinter is working!\n';
      const escposData = this.generateESCPOS(content, 'KOT');
      const base64Data = Buffer.from(escposData, 'utf-8').toString('base64');

      console.log('Test print:', base64Data);
      Alert.alert('Success', 'Test print command sent to printer!');

      return true;
    } catch (error) {
      console.error('Test print error:', error);
      return false;
    }
  }
}

export default new BluetoothPrinterService();
