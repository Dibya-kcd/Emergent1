import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ScrollView,
} from 'react-native';
import { useMenuStore } from '../stores/menuStore';
import { MenuItem } from '../types';
import { theme } from '../constants/theme';

const CATEGORIES = ['Starters', 'Main Course', 'Desserts', 'Beverages', 'Specials'];

export default function MenuScreen() {
  const { items, loading, fetchMenu, addItem, updateItem, deleteItem } = useMenuStore();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [formData, setFormData] = useState<Partial<MenuItem>>({
    name: '',
    category: 'Starters',
    price: 0,
    stock: 100,
    soldOut: false,
    emoji: '🍽️',
    description: '',
  });

  useEffect(() => {
    fetchMenu();
  }, []);

  const filteredItems = selectedCategory === 'All'
    ? items
    : items.filter((item) => item.category === selectedCategory);

  const handleSave = async () => {
    if (!formData.name || !formData.price) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      if (editingItem) {
        await updateItem(editingItem._id!, formData as MenuItem);
      } else {
        await addItem(formData as MenuItem);
      }
      setModalVisible(false);
      resetForm();
    } catch (error) {
      Alert.alert('Error', 'Failed to save item');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Confirm Delete',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteItem(id);
            } catch (error) {
              Alert.alert('Error', 'Failed to delete item');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: 'Starters',
      price: 0,
      stock: 100,
      soldOut: false,
      emoji: '🍽️',
      description: '',
    });
    setEditingItem(null);
  };

  const openEditModal = (item: MenuItem) => {
    setEditingItem(item);
    setFormData(item);
    setModalVisible(true);
  };

  const renderMenuItem = ({ item }: { item: MenuItem }) => (
    <TouchableOpacity
      style={styles.menuCard}
      onLongPress={() => openEditModal(item)}
    >
      <Text style={styles.emoji}>{item.emoji || '🍽️'}</Text>
      <View style={styles.menuInfo}>
        <Text style={styles.menuName}>{item.name}</Text>
        <Text style={styles.menuCategory}>{item.category}</Text>
        <View style={styles.menuFooter}>
          <Text style={styles.menuPrice}>₹{item.price}</Text>
          <Text style={[styles.stockBadge, item.soldOut && styles.soldOutBadge]}>
            {item.soldOut ? 'SOLD OUT' : `Stock: ${item.stock}`}
          </Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDelete(item._id!)}
      >
        <Text style={styles.deleteButtonText}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Menu</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryContainer}
      >
        <TouchableOpacity
          style={[
            styles.categoryChip,
            selectedCategory === 'All' && styles.categoryChipActive,
          ]}
          onPress={() => setSelectedCategory('All')}
        >
          <Text
            style={[
              styles.categoryText,
              selectedCategory === 'All' && styles.categoryTextActive,
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {CATEGORIES.map((cat) => (
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

      {/* Menu Items */}
      <FlatList
        data={filteredItems}
        renderItem={renderMenuItem}
        keyExtractor={(item) => item._id!}
        numColumns={2}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading...' : 'No items found. Add your first menu item!'}
          </Text>
        }
      />

      {/* Add/Edit Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {editingItem ? 'Edit Item' : 'Add New Item'}
            </Text>

            <ScrollView style={styles.form}>
              <Text style={styles.label}>Emoji</Text>
              <TextInput
                style={styles.input}
                value={formData.emoji}
                onChangeText={(text) => setFormData({ ...formData, emoji: text })}
                placeholder="🍽️"
                placeholderTextColor={theme.colors.textSecondary}
              />

              <Text style={styles.label}>Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Item name"
                placeholderTextColor={theme.colors.textSecondary}
              />

              <Text style={styles.label}>Category *</Text>
              <View style={styles.categoryGrid}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryOption,
                      formData.category === cat && styles.categoryOptionActive,
                    ]}
                    onPress={() => setFormData({ ...formData, category: cat })}
                  >
                    <Text
                      style={[
                        styles.categoryOptionText,
                        formData.category === cat && styles.categoryOptionTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput
                style={styles.input}
                value={formData.price?.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, price: parseFloat(text) || 0 })
                }
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={theme.colors.textSecondary}
              />

              <Text style={styles.label}>Stock</Text>
              <TextInput
                style={styles.input}
                value={formData.stock?.toString()}
                onChangeText={(text) =>
                  setFormData({ ...formData, stock: parseInt(text) || 0 })
                }
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={theme.colors.textSecondary}
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                multiline
                numberOfLines={3}
                placeholder="Optional description"
                placeholderTextColor={theme.colors.textSecondary}
              />
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSave}
              >
                <Text style={styles.saveButtonText}>Save</Text>
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
  addButton: {
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
  },
  addButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  categoryContainer: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
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
  listContainer: {
    padding: theme.spacing.md,
  },
  menuCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    margin: theme.spacing.sm,
    minHeight: 140,
  },
  emoji: {
    fontSize: 40,
    marginBottom: theme.spacing.sm,
  },
  menuInfo: {
    flex: 1,
  },
  menuName: {
    fontSize: theme.fontSize.md,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  menuCategory: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  menuFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  menuPrice: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  stockBadge: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.success,
  },
  soldOutBadge: {
    color: theme.colors.danger,
  },
  deleteButton: {
    position: 'absolute',
    top: theme.spacing.xs,
    right: theme.spacing.xs,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    color: theme.colors.text,
    fontSize: 20,
    lineHeight: 24,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.xl,
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
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  form: {
    maxHeight: 400,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  categoryOption: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  categoryOptionActive: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  categoryOptionText: {
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.sm,
  },
  categoryOptionTextActive: {
    color: theme.colors.text,
    fontWeight: '600',
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
  saveButton: {
    backgroundColor: theme.colors.primary,
  },
  saveButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.md,
    fontWeight: '600',
  },
});
