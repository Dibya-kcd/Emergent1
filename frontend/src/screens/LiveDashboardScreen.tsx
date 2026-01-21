import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useLiveStore } from '../stores/liveStore';
import { theme } from '../constants/theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

export default function LiveDashboardScreen() {
  const {
    connected,
    activeOrders,
    pendingKOTs,
    occupiedTables,
    todayStats,
    connect,
    disconnect,
    fetchLiveDashboard,
    subscribeToOrders,
    subscribeToKitchen,
  } = useLiveStore();

  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    connect();
    fetchLiveDashboard();
    subscribeToOrders();
    subscribeToKitchen();

    // Refresh every 10 seconds
    const interval = setInterval(fetchLiveDashboard, 10000);

    return () => {
      clearInterval(interval);
      disconnect();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLiveDashboard();
    setRefreshing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return theme.colors.danger;
      case 'preparing':
        return theme.colors.primary;
      case 'ready':
        return theme.colors.success;
      default:
        return theme.colors.textSecondary;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Live Dashboard</Text>
        <View style={styles.connectionIndicator}>
          <View
            style={[
              styles.connectionDot,
              { backgroundColor: connected ? theme.colors.success : theme.colors.danger },
            ]}
          />
          <Text style={styles.connectionText}>
            {connected ? 'Live' : 'Offline'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Today's Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, styles.revenueCard]}>
            <MaterialCommunityIcons name="cash" size={32} color={theme.colors.success} />
            <Text style={styles.statValue}>₹{todayStats.revenue.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Today's Revenue</Text>
          </View>

          <View style={[styles.statCard, styles.ordersCard]}>
            <MaterialCommunityIcons name="receipt" size={32} color={theme.colors.info} />
            <Text style={styles.statValue}>{todayStats.totalOrders}</Text>
            <Text style={styles.statLabel}>Total Orders</Text>
          </View>

          <View style={[styles.statCard, styles.avgCard]}>
            <MaterialCommunityIcons name="chart-line" size={32} color={theme.colors.primary} />
            <Text style={styles.statValue}>₹{todayStats.averageOrder.toFixed(2)}</Text>
            <Text style={styles.statLabel}>Avg Order Value</Text>
          </View>
        </View>

        {/* Active Orders */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Orders</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeOrders.length}</Text>
            </View>
          </View>

          {activeOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="food-off"
                size={48}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.emptyText}>No active orders</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {activeOrders.map((order) => (
                <View key={order._id} style={styles.orderCard}>
                  <View style={styles.orderHeader}>
                    <Text style={styles.orderTitle}>
                      {order.orderType === 'dine-in'
                        ? `Table ${order.tableNumber}`
                        : `T-${order.tokenNumber}`}
                    </Text>
                    <View
                      style={[
                        styles.orderStatus,
                        { backgroundColor: getStatusColor(order.status) },
                      ]}
                    >
                      <Text style={styles.orderStatusText}>
                        {order.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.orderTime}>
                    {order.createdAt
                      ? format(new Date(order.createdAt), 'hh:mm a')
                      : 'Just now'}
                  </Text>

                  <View style={styles.orderItems}>
                    {order.items.slice(0, 3).map((item: any, index: number) => (
                      <Text key={index} style={styles.orderItem}>
                        {item.quantity}x {item.name}
                      </Text>
                    ))}
                    {order.items.length > 3 && (
                      <Text style={styles.orderItemMore}>
                        +{order.items.length - 3} more
                      </Text>
                    )}
                  </View>

                  <Text style={styles.orderTotal}>₹{order.total.toFixed(2)}</Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Pending KOTs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Kitchen Orders</Text>
            <View style={[styles.badge, styles.badgeDanger]}>
              <Text style={styles.badgeText}>{pendingKOTs.length}</Text>
            </View>
          </View>

          {pendingKOTs.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons
                name="chef-hat"
                size={48}
                color={theme.colors.textSecondary}
              />
              <Text style={styles.emptyText}>No pending KOTs</Text>
            </View>
          ) : (
            pendingKOTs.map((kot) => (
              <View key={kot._id} style={styles.kotCard}>
                <View style={styles.kotHeader}>
                  <Text style={styles.kotTitle}>
                    {kot.orderType === 'dine-in'
                      ? `Table ${kot.tableNumber}`
                      : `T-${kot.tokenNumber}`}
                  </Text>
                  <Text style={styles.kotTime}>
                    {kot.createdAt
                      ? format(new Date(kot.createdAt), 'hh:mm a')
                      : 'Just now'}
                  </Text>
                </View>

                <View style={styles.kotItems}>
                  {kot.items.map((item: any, index: number) => (
                    <Text key={index} style={styles.kotItem}>
                      {item.quantity}x {item.name}
                    </Text>
                  ))}
                </View>
              </View>
            ))
          )}
        </View>

        {/* Occupied Tables */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Occupied Tables</Text>
            <View style={[styles.badge, styles.badgeWarning]}>
              <Text style={styles.badgeText}>{occupiedTables.length}</Text>
            </View>
          </View>

          <View style={styles.tablesGrid}>
            {occupiedTables.map((table) => (
              <View key={table._id} style={styles.tableCard}>
                <Text style={styles.tableNumber}>{table.tableNumber}</Text>
                <Text style={styles.tableStatus}>{table.status}</Text>
              </View>
            ))}
          </View>
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
  connectionIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  connectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  connectionText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  content: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    padding: theme.spacing.md,
    gap: theme.spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  revenueCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.success,
  },
  ordersCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.info,
  },
  avgCard: {
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.primary,
  },
  statValue: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  statLabel: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
    textAlign: 'center',
  },
  section: {
    padding: theme.spacing.md,
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
  badge: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.sm,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeDanger: {
    backgroundColor: theme.colors.danger,
  },
  badgeWarning: {
    backgroundColor: theme.colors.primary,
  },
  badgeText: {
    fontSize: theme.fontSize.sm,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  emptyState: {
    alignItems: 'center',
    padding: theme.spacing.xl,
  },
  emptyText: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  orderCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginRight: theme.spacing.md,
    width: 220,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  orderTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  orderStatus: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  orderStatusText: {
    fontSize: theme.fontSize.xs,
    fontWeight: '600',
    color: theme.colors.text,
  },
  orderTime: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
  },
  orderItems: {
    marginBottom: theme.spacing.sm,
  },
  orderItem: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  orderItemMore: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  orderTotal: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  kotCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.danger,
  },
  kotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  kotTitle: {
    fontSize: theme.fontSize.md,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  kotTime: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  kotItems: {},
  kotItem: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  tablesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  tableCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.md,
    alignItems: 'center',
    minWidth: 80,
    borderWidth: 2,
    borderColor: theme.colors.primary,
  },
  tableNumber: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  tableStatus: {
    fontSize: theme.fontSize.xs,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.xs,
  },
});
