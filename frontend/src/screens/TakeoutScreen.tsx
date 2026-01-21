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
import { useRouter } from 'expo-router';
import { useMenuStore } from '../stores/menuStore';
import { useOrderStore } from '../stores/orderStore';
import { useKOTStore } from '../stores/kotStore';
import { theme } from '../constants/theme';
import { OrderItem, MenuItem } from '../types';
import api from '../utils/api';

export default function TakeoutScreen() {
  const router = useRouter();
  const { items: menuItems, fetchMenu } = useMenuStore();
  const { createOrder } = useOrderStore();
  const { createKOT } = useKOTStore();

  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [nextToken, setNextToken] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  useEffect(() => {
    fetchMenu();
    fetchNextToken();
  }, []);

  const fetchNextToken = async () => {
    try {
      const response = await api.get('/takeout/next-token');
      setNextToken(response.data.nextToken);
    } catch (error) {
      console.error('Fetch token error:', error);
    }
  };

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

  const calculateTotal = () => {
    const subtotal = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const tax = subtotal * 0.05;
    return { subtotal, tax, total: subtotal + tax };
  };

  const handlePlaceOrder = () => {
    if (orderItems.length === 0) {
      Alert.alert('Error', 'Please add items to the order');
      return;
    }
    setShowCustomerModal(true);
  };

  const handleConfirmOrder = async () => {
    try {
      const { subtotal, tax, total } = calculateTotal();
      
      const order = await createOrder({
        orderType: 'takeout',
        tokenNumber: nextToken,
        items: orderItems,
        status: 'pending',
        subtotal,
        tax,
        total,
        paymentStatus: 'unpaid',
        kotSent: false,
      });

      await createKOT({
        orderId: order._id!,
        orderType: 'takeout',
        tokenNumber: nextToken,
        items: orderItems,
        status: 'pending',
      });

      setShowCustomerModal(false);
      Alert.alert(
        'Order Placed!',
        `Takeout Token #${nextToken}\n\nCustomer: ${customerName || 'Guest'}\n${customerPhone ? `Phone: ${customerPhone}` : ''}`,
        [
          {
            text: 'OK',
            onPress: () => {
              setOrderItems([]);
              setCustomerName('');
              setCustomerPhone('');
              fetchNextToken();
            },
          },
        ]
      );
    } catch (error) {
      console.error('Place order error:', error);
      Alert.alert('Error', 'Failed to place order');
    }
  };

  const { subtotal, tax, total } = calculateTotal();

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Takeout Orders</Text>
          <Text style={styles.tokenText}>Next Token: #{nextToken}</Text>
        </View>
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
              styles.placeOrderButton,
              orderItems.length === 0 && styles.placeOrderButtonDisabled,
            ]}
            onPress={handlePlaceOrder}
            disabled={orderItems.length === 0}
          >
            <Text style={styles.placeOrderButtonText}>Place Takeout Order</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Info Modal */}
      <Modal
        visible={showCustomerModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomerModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Customer Information</Text>
            <Text style={styles.modalSubtitle}>Token #{nextToken}</Text>

            <Text style={styles.label}>Customer Name (Optional)</Text>
            <TextInput
              style={styles.input}
              value={customerName}
              onChangeText={setCustomerName}
              placeholder="Enter customer name"
              placeholderTextColor={theme.colors.textSecondary}
            />

            <Text style={styles.label}>Phone Number (Optional)</Text>
            <TextInput
              style={styles.input}
              value={customerPhone}
              onChangeText={setCustomerPhone}
              placeholder="Enter phone number"
              placeholderTextColor={theme.colors.textSecondary}
              keyboardType="phone-pad"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowCustomerModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleConfirmOrder}
              >
                <Text style={styles.confirmButtonText}>Confirm Order</Text>
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
  tokenText: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: theme.spacing.xs,
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
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    alignSelf: 'flex-start',
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
  placeOrderButton: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  placeOrderButtonDisabled: {
    backgroundColor: theme.colors.surface,
  },
  placeOrderButtonText: {
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
    marginBottom: theme.spacing.xs,
  },
  modalSubtitle: {
    fontSize: theme.fontSize.lg,
    color: theme.colors.primary,
    fontWeight: 'bold',
    marginBottom: theme.spacing.lg,
  },
  label: {
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
    color: theme.colors.text,
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.xs,
  },
  input: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
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
  confirmButton: {
    backgroundColor: theme.colors.primary,
  },
  confirmButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
