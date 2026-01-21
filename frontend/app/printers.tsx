import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../src/constants/theme';
import printerService from '../src/services/printerService';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function PrintersScreen() {
  const [scanning, setScanning] = useState(false);
  const [printers, setPrinters] = useState<any[]>([]);

  const handleScan = async () => {
    setScanning(true);
    setPrinters([]);
    
    await printerService.scanForPrinters((device) => {
      setPrinters((prev) => [...prev, device]);
    });

    setTimeout(() => {
      setScanning(false);
    }, 10000);
  };

  const handleConnect = async (deviceId: string, deviceName: string) => {
    const success = await printerService.connectToPrinter(deviceId);
    if (success) {
      Alert.alert('Success', `Connected to ${deviceName}`);
    } else {
      Alert.alert('Error', 'Failed to connect to printer');
    }
  };

  const handleTestPrint = async () => {
    const success = await printerService.testPrint();
    if (success) {
      Alert.alert('Success', 'Test print sent!');
    } else {
      Alert.alert('Error', 'Failed to print. Please connect to a printer first.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Printer Settings</Text>
        <TouchableOpacity
          style={styles.testButton}
          onPress={handleTestPrint}
        >
          <Text style={styles.testButtonText}>Test Print</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScan}
          disabled={scanning}
        >
          <MaterialCommunityIcons
            name="bluetooth-search"
            size={24}
            color={theme.colors.text}
          />
          <Text style={styles.scanButtonText}>
            {scanning ? 'Scanning...' : 'Scan for Bluetooth Printers'}
          </Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Printers</Text>

          {printers.length === 0 && !scanning && (
            <Text style={styles.emptyText}>No printers found. Tap scan to search.</Text>
          )}

          {printers.map((printer) => (
            <TouchableOpacity
              key={printer.id}
              style={styles.printerCard}
              onPress={() => handleConnect(printer.id, printer.name)}
            >
              <MaterialCommunityIcons
                name="printer"
                size={32}
                color={theme.colors.primary}
              />
              <View style={styles.printerInfo}>
                <Text style={styles.printerName}>{printer.name}</Text>
                <Text style={styles.printerId}>{printer.id}</Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <MaterialCommunityIcons
            name="information"
            size={24}
            color={theme.colors.info}
          />
          <Text style={styles.infoText}>
            Make sure Bluetooth is enabled and the printer is in pairing mode.
            Supported: 80mm thermal printers with ESC/POS commands.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  testButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  testButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  scanButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  section: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    padding: theme.spacing.xl,
  },
  printerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    gap: theme.spacing.md,
  },
  printerInfo: {
    flex: 1,
  },
  printerName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  printerId: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    gap: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info,
  },
  infoText: {
    flex: 1,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
});
