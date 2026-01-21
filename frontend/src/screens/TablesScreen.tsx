import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useTableStore } from '../stores/tableStore';
import { useRouter } from 'expo-router';
import { theme } from '../constants/theme';
import { Table } from '../types';

export default function TablesScreen() {
  const { tables, loading, fetchTables } = useTableStore();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTables();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTables();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return theme.colors.success;
      case 'occupied':
      case 'preparing':
        return theme.colors.primary;
      case 'serving':
        return theme.colors.info;
      case 'billing':
        return theme.colors.danger;
      default:
        return theme.colors.textSecondary;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleTablePress = (table: Table) => {
    if (table.status === 'available') {
      // Navigate to order screen for this table
      router.push(`/order?tableNumber=${table.tableNumber}&type=dine-in`);
    } else if (table.currentOrder) {
      // Navigate to existing order
      router.push(`/order?orderId=${table.currentOrder}`);
    }
  };

  const renderTable = ({ item }: { item: Table }) => (
    <TouchableOpacity
      style={[
        styles.tableCard,
        { borderColor: getStatusColor(item.status) },
      ]}
      onPress={() => handleTablePress(item)}
    >
      <View style={styles.tableNumber}>
        <Text style={styles.tableNumberText}>{item.tableNumber}</Text>
      </View>
      <View
        style={[
          styles.statusBadge,
          { backgroundColor: getStatusColor(item.status) },
        ]}
      >
        <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
      </View>
      <Text style={styles.capacityText}>👥 {item.capacity} seats</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tables</Text>
        <View style={styles.stats}>
          <Text style={styles.statText}>
            Available: {tables.filter((t) => t.status === 'available').length}
          </Text>
          <Text style={styles.statText}>
            Occupied: {tables.filter((t) => t.status !== 'available').length}
          </Text>
        </View>
      </View>

      <FlatList
        data={tables}
        renderItem={renderTable}
        keyExtractor={(item) => item._id!}
        numColumns={3}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            {loading ? 'Loading tables...' : 'No tables found'}
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
  tableCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    margin: theme.spacing.sm,
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  tableNumber: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  tableNumberText: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  statusBadge: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  statusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.text,
  },
  capacityText: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.textSecondary,
    fontSize: theme.fontSize.md,
    marginTop: theme.spacing.xl,
  },
});
