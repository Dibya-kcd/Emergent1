import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { theme } from '../src/constants/theme';
import thermalPrinterService from '../src/services/thermalPrinterService';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface SavedPrinter {
  id: string;
  name: string;
  address: string;
  type: 'BLE' | 'Classic';
  role: 'KOT' | 'Bill' | 'Both';
  isDefault: boolean;
  lastConnected?: Date;
}

const PRINTERS_KEY = '@resto_saved_printers';

export default function PrinterManagementScreen() {
  const [scanning, setScanning] = useState(false);
  const [availablePrinters, setAvailablePrinters] = useState<any[]>([]);
  const [savedPrinters, setSavedPrinters] = useState<SavedPrinter[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);
  const [printerRole, setPrinterRole] = useState<'KOT' | 'Bill' | 'Both'>('Both');
  const [isDefault, setIsDefault] = useState(false);

  useEffect(() => {
    loadSavedPrinters();
  }, []);

  const loadSavedPrinters = async () => {
    try {
      const saved = await AsyncStorage.getItem(PRINTERS_KEY);
      if (saved) {
        setSavedPrinters(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Load printers error:', error);
    }
  };

  const savePrinters = async (printers: SavedPrinter[]) => {
    try {
      await AsyncStorage.setItem(PRINTERS_KEY, JSON.stringify(printers));
      setSavedPrinters(printers);
    } catch (error) {
      console.error('Save printers error:', error);
    }
  };

  const handleScanClassic = async () => {
    setScanning(true);
    setAvailablePrinters([]);

    try {
      const printers = await thermalPrinterService.scanClassicPrinters();
      
      if (printers.length === 0) {
        Alert.alert(
          'No Printers Found',
          'Make sure your thermal printers are:\n\n' +
          '1. Powered on\n' +
          '2. Paired with your device (Settings > Bluetooth)\n' +
          '3. Within range\n\n' +
          'Common printer names: RPP, POS, Thermal, Printer'
        );
      } else {
        setAvailablePrinters(printers);
      }
    } catch (error) {
      Alert.alert('Scan Error', 'Failed to scan for printers. Please try again.');
    } finally {
      setScanning(false);
    }
  };

  const handleConfigurePrinter = (printer: any) => {
    setSelectedPrinter(printer);
    setPrinterRole('Both');
    setIsDefault(savedPrinters.length === 0);
    setShowConfigModal(true);
  };

  const handleSavePrinterConfig = () => {
    if (!selectedPrinter) return;

    const newPrinter: SavedPrinter = {
      ...selectedPrinter,
      role: printerRole,
      isDefault,
      lastConnected: new Date(),
    };

    // If this is set as default, remove default from others
    let updated = [...savedPrinters];
    if (isDefault) {
      updated = updated.map(p => ({ ...p, isDefault: false }));
    }

    // Check if printer already exists
    const existingIndex = updated.findIndex(p => p.id === newPrinter.id);
    if (existingIndex >= 0) {
      updated[existingIndex] = newPrinter;
    } else {
      updated.push(newPrinter);
    }

    savePrinters(updated);
    setShowConfigModal(false);
    Alert.alert('Success', `Printer configured for ${printerRole}`);
  };

  const handleRemovePrinter = (printerId: string) => {
    Alert.alert(
      'Remove Printer',
      'Are you sure you want to remove this printer?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            const updated = savedPrinters.filter(p => p.id !== printerId);
            savePrinters(updated);
          },
        },
      ]
    );
  };

  const handleTestPrint = async (printer: SavedPrinter) => {
    try {
      const success = await thermalPrinterService.testPrint(printer);
      if (!success) {
        Alert.alert('Test Failed', 'Unable to print. Please check printer connection.');
      }
    } catch (error) {
      Alert.alert('Error', 'Test print failed. Please try again.');
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'KOT':
        return 'chef-hat';
      case 'Bill':
        return 'receipt';
      case 'Both':
        return 'printer-check';
      default:
        return 'printer';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'KOT':
        return theme.colors.primary;
      case 'Bill':
        return theme.colors.success;
      case 'Both':
        return theme.colors.info;
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Printer Management</Text>
        <Text style={styles.subtitle}>Configure 80mm Thermal Printers</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Saved Printers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Configured Printers</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{savedPrinters.length}</Text>
            </View>
          </View>

          {savedPrinters.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="printer-off"
                size={48}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.emptyText}>No printers configured yet</Text>
              <Text style={styles.emptySubtext}>Scan and configure your thermal printers below</Text>
            </View>
          ) : (
            savedPrinters.map((printer) => (
              <View key={printer.id} style={styles.printerCard}>
                <View style={styles.printerHeader}>
                  <View style={styles.printerInfo}>
                    <MaterialCommunityIcons
                      name={getRoleIcon(printer.role)}
                      size={32}
                      color={getRoleColor(printer.role)}
                    />
                    <View style={styles.printerDetails}>
                      <Text style={styles.printerName}>{printer.name}</Text>
                      <Text style={styles.printerAddress}>{printer.address}</Text>
                      <View style={styles.printerTags}>
                        <View style={[styles.tag, { backgroundColor: getRoleColor(printer.role) + '20' }]}>
                          <Text style={[styles.tagText, { color: getRoleColor(printer.role) }]}>
                            {printer.role}
                          </Text>
                        </View>
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{printer.type}</Text>
                        </View>
                        {printer.isDefault && (
                          <View style={[styles.tag, styles.defaultTag]}>
                            <Text style={styles.defaultTagText}>DEFAULT</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.printerActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleTestPrint(printer)}
                  >
                    <MaterialCommunityIcons name="printer-check" size={20} color={theme.colors.text} />
                    <Text style={styles.actionButtonText}>Test</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleConfigurePrinter(printer)}
                  >
                    <MaterialCommunityIcons name="cog" size={20} color={theme.colors.text} />
                    <Text style={styles.actionButtonText}>Config</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleRemovePrinter(printer.id)}
                  >
                    <MaterialCommunityIcons name="delete" size={20} color={theme.colors.danger} />
                    <Text style={[styles.actionButtonText, { color: theme.colors.danger }]}>Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Scan Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Add New Printer</Text>

          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleScanClassic}
            disabled={scanning}
          >
            {scanning ? (
              <ActivityIndicator size="small" color={theme.colors.text} />
            ) : (
              <MaterialCommunityIcons
                name="bluetooth-search"
                size={24}
                color={theme.colors.text}
              />
            )}
            <Text style={styles.scanButtonText}>
              {scanning ? 'Scanning for Paired Printers...' : 'Scan Bluetooth Printers'}
            </Text>
          </TouchableOpacity>

          {availablePrinters.length > 0 && (
            <View style={styles.availablePrinters}>
              <Text style={styles.subsectionTitle}>Available Printers</Text>
              {availablePrinters.map((printer) => (
                <TouchableOpacity
                  key={printer.id}
                  style={styles.availablePrinterCard}
                  onPress={() => handleConfigurePrinter(printer)}
                >
                  <MaterialCommunityIcons
                    name="printer"
                    size={24}
                    color={theme.colors.primary}
                  />
                  <View style={styles.availablePrinterInfo}>
                    <Text style={styles.availablePrinterName}>{printer.name}</Text>
                    <Text style={styles.availablePrinterType}>{printer.type} Bluetooth</Text>
                  </View>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={24}
                    color={theme.colors.textSecondary}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.infoBox}>
          <MaterialCommunityIcons
            name="information"
            size={24}
            color={theme.colors.info}
          />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Setup Instructions:</Text>
            <Text style={styles.infoText}>
              1. Make sure Bluetooth is enabled{'\n'}
              2. Pair your printer in Android Settings{'\n'}
              3. Tap "Scan Bluetooth Printers"{'\n'}
              4. Select printer and configure role{'\n'}
              5. Test print to verify connection
            </Text>
            <Text style={styles.infoNote}>
              Supports: Classic Bluetooth 80mm thermal printers
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Configuration Modal */}
      <Modal
        visible={showConfigModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowConfigModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Configure Printer</Text>
            <Text style={styles.modalSubtitle}>{selectedPrinter?.name}</Text>

            <View style={styles.configSection}>
              <Text style={styles.configLabel}>Printer Role</Text>
              <View style={styles.roleButtons}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    printerRole === 'KOT' && styles.roleButtonActive,
                  ]}
                  onPress={() => setPrinterRole('KOT')}
                >
                  <MaterialCommunityIcons
                    name="chef-hat"
                    size={24}
                    color={printerRole === 'KOT' ? theme.colors.text : theme.colors.textSecondary}
                  />
                  <Text style={[
                    styles.roleButtonText,
                    printerRole === 'KOT' && styles.roleButtonTextActive,
                  ]}>KOT Only</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    printerRole === 'Bill' && styles.roleButtonActive,
                  ]}
                  onPress={() => setPrinterRole('Bill')}
                >
                  <MaterialCommunityIcons
                    name="receipt"
                    size={24}
                    color={printerRole === 'Bill' ? theme.colors.text : theme.colors.textSecondary}
                  />
                  <Text style={[
                    styles.roleButtonText,
                    printerRole === 'Bill' && styles.roleButtonTextActive,
                  ]}>Bill Only</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    printerRole === 'Both' && styles.roleButtonActive,
                  ]}
                  onPress={() => setPrinterRole('Both')}
                >
                  <MaterialCommunityIcons
                    name="printer-check"
                    size={24}
                    color={printerRole === 'Both' ? theme.colors.text : theme.colors.textSecondary}
                  />
                  <Text style={[
                    styles.roleButtonText,
                    printerRole === 'Both' && styles.roleButtonTextActive,
                  ]}>Both</Text>
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setIsDefault(!isDefault)}
            >
              <MaterialCommunityIcons
                name={isDefault ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={24}
                color={isDefault ? theme.colors.primary : theme.colors.textSecondary}
              />
              <Text style={styles.checkboxLabel}>Set as default printer</Text>
            </TouchableOpacity>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowConfigModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSavePrinterConfig}
              >
                <Text style={styles.saveButtonText}>Save Configuration</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  content: {
    flex: 1,
    padding: theme.spacing.md,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  subsectionTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  emptySubtext: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  printerCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  printerHeader: {
    marginBottom: theme.spacing.md,
  },
  printerInfo: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  printerDetails: {
    flex: 1,
  },
  printerName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  printerAddress: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  printerTags: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  tag: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  tagText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  defaultTag: {
    backgroundColor: theme.colors.primary + '20',
  },
  defaultTagText: {
    color: theme.colors.primary,
    fontWeight: 'bold',
  },
  printerActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.sm,
  },
  removeButton: {
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  actionButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    fontWeight: '600',
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  scanButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  availablePrinters: {
    marginTop: theme.spacing.md,
  },
  availablePrinterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  availablePrinterInfo: {
    flex: 1,
  },
  availablePrinterName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  availablePrinterType: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  infoText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    lineHeight: 20,
  },
  infoNote: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.borderRadius.lg,
    borderTopRightRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
  },
  configSection: {
    marginBottom: theme.spacing.lg,
  },
  configLabel: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  roleButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  roleButton: {
    flex: 1,
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  roleButtonActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  roleButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: theme.colors.text,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  checkboxLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
