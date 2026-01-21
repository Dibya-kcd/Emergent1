import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { useKOTStore } from '../stores/kotStore';
import { theme } from '../constants/theme';
import { KOTBatch } from '../types';
import { format } from 'date-fns';

export default function KitchenScreen() {
  const { kots, loading, fetchKOTs, updateKOT } = useKOTStore();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchKOTs();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchKOTs, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchKOTs();
    setRefreshing(false);
  };

  const handleUpdateStatus = async (kot: KOTBatch, newStatus: string) => {
    try {
      await updateKOT(kot._id!, { ...kot, status: newStatus as any });
    } catch (error) {
      Alert.alert('Error', 'Failed to update KOT status');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.colors.danger;
      case 'preparing':
        return theme.colors.primary;
      case 'completed':
        return theme.colors.success;
      case 'cancelled':
        return theme.colors.textSecondary;
      default:
        return theme.colors.textSecondary;
    }
  };

  const renderKOT = ({ item }: { item: KOTBatch }) => (
    <View style={styles.kotCard}>
      <View style={styles.kotHeader}>
        <View>
          <Text style={styles.kotTitle}>
            {item.orderType === 'dine-in'
              ? `Table ${item.tableNumber}`
              : `Takeout #${item.tokenNumber}`}
          </Text>
          <Text style={styles.kotTime}>
            {item.createdAt
              ? format(new Date(item.createdAt), 'hh:mm a')
              : 'Just now'}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(item.status) },
          ]}
        >
          <Text style={styles.statusText}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.itemsList}>
        {item.items.map((orderItem, index) => (
          <View key={index} style={styles.kotItem}>
            <Text style={styles.itemQuantity}>{orderItem.quantity}x</Text>
            <Text style={styles.itemName}>{orderItem.name}</Text>
            {orderItem.instructions && (
              <Text style={styles.itemInstructions}>
                Note: {orderItem.instructions}
              </Text>
            )}
          </View>
        ))}
      </View>

      <View style={styles.kotActions}>
        {item.status === 'pending' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.startButton]}
            onPress={() => handleUpdateStatus(item, 'preparing')}
          >
            <Text style={styles.actionButtonText}>Start Preparing</Text>
          </TouchableOpacity>
        )}
        {item.status === 'preparing' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.completeButton]}
            onPress={() => handleUpdateStatus(item, 'completed')}
          >
            <Text style={styles.actionButtonText}>Mark Complete</Text>
          </TouchableOpacity>
        )}
        {item.status !== 'completed' && item.status !== 'cancelled' && (
          <TouchableOpacity
            style={[styles.actionButton, styles.cancelButton]}
            onPress={() => {
              Alert.alert(
                'Cancel KOT',
                'Are you sure you want to cancel this KOT?',
                [
                  { text: 'No', style: 'cancel' },
                  {
                    text: 'Yes',
                    style: 'destructive',
                    onPress: () => handleUpdateStatus(item, 'cancelled'),
                  },
                ]
              );
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const pendingKOTs = kots.filter(
    (k) => k.status === 'pending' || k.status === 'preparing'
  );
  const completedKOTs = kots.filter((k) => k.status === 'completed');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Kitchen Orders</Text>
        <View style={styles.stats}>
          <Text style={styles.statText}>Pending: {pendingKOTs.length}</Text>
        </View>
      </View>

      <FlatList
        data={kots.filter((k) => k.status !== 'cancelled')}
        renderItem={renderKOT}
        keyExtractor={(item) => item._id!}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading KOTs...' : 'No pending orders in kitchen'}
          </Text>
        }
      />
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
    marginBottom: theme.spacing.sm,
  },
  stats: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  statText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  listContainer: {
    padding: theme.spacing.md,
  },
  kotCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  kotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  kotTitle: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  kotTime: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.text,
  },
  itemsList: {
    marginBottom: theme.spacing.md,
  },
  kotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  itemQuantity: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginRight: theme.spacing.sm,
    minWidth: 40,
  },
  itemName: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
  },
  itemInstructions: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginLeft: 40,
    marginTop: theme.spacing.xs,
  },
  kotActions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: theme.colors.primary,
  },
  completeButton: {
    backgroundColor: theme.colors.success,
  },
  cancelButton: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  actionButtonText: {
    color: theme.colors.text,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  cancelButtonText: {
    color: theme.colors.danger,
    fontSize: theme.fontSize.sm,
    fontWeight: '600',
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.xl,
  },
});
