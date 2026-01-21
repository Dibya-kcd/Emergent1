import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useMenuStore } from '../stores/menuStore';
import { useOrderStore } from '../stores/orderStore';
import { useKOTStore } from '../stores/kotStore';
import { useTableStore } from '../stores/tableStore';
import { theme } from '../constants/theme';
import { OrderItem, MenuItem } from '../types';

export default function OrderScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { items: menuItems, fetchMenu } = useMenuStore();
  const { createOrder } = useOrderStore();
  const { createKOT } = useKOTStore();
  const { updateTable } = useTableStore();

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [instructions, setInstructions] = useState('');
  const [showInstructionsModal, setShowInstructionsModal] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);

  const orderType = params.type as string || 'dine-in';
  const tableNumber = params.tableNumber ? parseInt(params.tableNumber as string) : undefined;
  const tokenNumber = params.tokenNumber ? parseInt(params.tokenNumber as string) : undefined;

  useEffect(() => {
    fetchMenu();
  }, []);

  const categories = ['All', ...Array.from(new Set(menuItems.map((item) => item.category)))];

  const filteredMenu = menuItems.filter((item) => {
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && !item.soldOut;
  });

  const addToOrder = (menuItem: MenuItem) => {
    const existingIndex = orderItems.findIndex((item) => item.menuItemId === menuItem._id);
    
    if (existingIndex >= 0) {
      const newItems = [...orderItems];
      newItems[existingIndex].quantity += 1;
      setOrderItems(newItems);
    } else {
      setOrderItems([
        ...orderItems,
        {
          menuItemId: menuItem._id!,
          name: menuItem.name,
          quantity: 1,
          price: menuItem.price,
          modifiers: [],
          instructions: '',
        },
      ]);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    const newItems = [...orderItems];
    newItems[index].quantity += delta;
    
    if (newItems[index].quantity <= 0) {
      newItems.splice(index, 1);
    }
    
    setOrderItems(newItems);
  };

  const addInstructionsToItem = (index: number) => {
    setSelectedItemIndex(index);
    setInstructions(orderItems[index].instructions || '');
    setShowInstructionsModal(true);
  };

  const saveInstructions = () => {
    if (selectedItemIndex !== null) {
      const newItems = [...orderItems];
      newItems[selectedItemIndex].instructions = instructions;
      setOrderItems(newItems);
    }
    setShowInstructionsModal(false);
    setInstructions('');
    setSelectedItemIndex(null);
  };

  const calculateTotal = () => {
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = subtotal * 0.05;
    return { subtotal, tax, total: subtotal + tax };
  };

  const handleSendKOT = async () => {
    if (orderItems.length === 0) {
      Alert.alert('Error', 'Please add items to the order');
      return;
    }

    try {
      const { subtotal, tax, total } = calculateTotal();
      
      // Create order
      const order = await createOrder({
        orderType: orderType as any,
        tableNumber,
        tokenNumber,
        items: orderItems,
        status: 'pending',
        subtotal,
        tax,
        total,
        paymentStatus: 'unpaid',
        kotSent: false,
      });

      // Create KOT
      await createKOT({
        orderId: order._id!,
        orderType,
        tableNumber,
        tokenNumber,
        items: orderItems,
        status: 'pending',
      });

      Alert.alert('Success', 'KOT sent to kitchen!', [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]);
    } catch (error) {
      console.error('Send KOT error:', error);
      Alert.alert('Error', 'Failed to send KOT');
    }
  };

  const { subtotal, tax, total } = calculateTotal();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>
          {orderType === 'dine-in' ? `Table ${tableNumber}` : `Takeout #${tokenNumber || 'New'}`}
        </Text>
      </View>

      <View style={styles.content}>
        {/* Menu Section */}
        <View style={styles.menuSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search menu..."
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryContainer}
          >
            {categories.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat && styles.categoryChipActive,
                ]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text
                  style={[
                    styles.categoryText,
                    selectedCategory === cat && styles.categoryTextActive,
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <ScrollView style={styles.menuList}>
            {filteredMenu.map((item) => (
              <TouchableOpacity
                key={item._id}
                style={styles.menuItem}
                onPress={() => addToOrder(item)}
              >
                <Text style={styles.menuEmoji}>{item.emoji}</Text>
                <View style={styles.menuItemInfo}>
                  <Text style={styles.menuItemName}>{item.name}</Text>
                  <Text style={styles.menuItemPrice}>₹{item.price}</Text>
                </View>
                <View style={styles.addButton}>
                  <Text style={styles.addButtonText}>+</Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Order Section */}
        <View style={styles.orderSection}>
          <Text style={styles.orderTitle}>Current Order</Text>
          
          <ScrollView style={styles.orderList}>
            {orderItems.map((item, index) => (
              <View key={index} style={styles.orderItem}>
                <View style={styles.orderItemHeader}>
                  <Text style={styles.orderItemName}>{item.name}</Text>
                  <Text style={styles.orderItemPrice}>
                    ₹{(item.price * item.quantity).toFixed(2)}
                  </Text>
                </View>
                
                <View style={styles.orderItemFooter}>
                  <View style={styles.quantityControl}>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(index, -1)}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(index, 1)}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.instructionsButton}
                    onPress={() => addInstructionsToItem(index)}
                  >
                    <Text style={styles.instructionsButtonText}>
                      {item.instructions ? '✓ Note' : '+ Note'}
                    </Text>
                  </TouchableOpacity>
                </View>
                
                {item.instructions && (
                  <Text style={styles.orderItemInstructions}>
                    Note: {item.instructions}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.orderSummary}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax (5%):</Text>
              <Text style={styles.summaryValue}>₹{tax.toFixed(2)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.kotButton,
              orderItems.length === 0 && styles.kotButtonDisabled,
            ]}
            onPress={handleSendKOT}
            disabled={orderItems.length === 0}
          >
            <Text style={styles.kotButtonText}>Send KOT to Kitchen</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Instructions Modal */}
      <Modal
        visible={showInstructionsModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowInstructionsModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Instructions</Text>
            <TextInput
              style={styles.instructionsInput}
              value={instructions}
              onChangeText={setInstructions}
              placeholder="e.g., Extra spicy, no onions"
              placeholderTextColor={theme.colors.textSecondary}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowInstructionsModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={saveInstructions}
              >
                <Text style={styles.saveButtonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.spacing.sm,
  },
  backButtonText: {
    fontSize: theme.fontSize.xl,
    color: theme.colors.text,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  menuSection: {
    flex: 1,
    borderRightWidth: 1,
    borderRightColor: theme.colors.border,
  },
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    margin: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
  },
  categoryContainer: {
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    marginRight: theme.spacing.sm,
  },
  categoryChipActive: {
    backgroundColor: theme.colors.primary,
  },
  categoryText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: theme.colors.text,
  },
  menuList: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  menuEmoji: {
    fontSize: 32,
    marginRight: theme.spacing.md,
  },
  menuItemInfo: {
    flex: 1,
  },
  menuItemName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  menuItemPrice: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.primary,
    fontWeight: '600',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  orderSection: {
    flex: 1,
    padding: theme.spacing.md,
  },
  orderTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  orderList: {
    flex: 1,
    marginBottom: theme.spacing.md,
  },
  orderItem: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  orderItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  orderItemName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
  },
  orderItemPrice: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  orderItemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
  },
  quantityButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.text,
    fontWeight: 'bold',
  },
  quantityText: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    paddingHorizontal: theme.spacing.md,
  },
  instructionsButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  instructionsButtonText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
  },
  orderItemInstructions: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
    fontStyle: 'italic',
  },
  orderSummary: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.sm,
  },
  summaryLabel: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
  },
  summaryValue: {
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  totalRow: {
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  totalLabel: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  totalValue: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  kotButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  kotButtonDisabled: {
    backgroundColor: theme.colors.surface,
  },
  kotButtonText: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  instructionsInput: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: theme.spacing.md,
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
    backgroundColor: theme.colors.surface,
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
