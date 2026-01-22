import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useRouter } from 'expo-router';
import { theme } from '../../src/constants/theme';

export default function MoreScreen() {
  const { user, logout } = useAuthStore();
  const router = useRouter();

  const menuItems = [
    {
      title: 'Takeout Orders',
      icon: 'food-takeout-box',
      onPress: () => router.push('/takeout'),
    },
    {
      title: 'Live Dashboard',
      icon: 'monitor-dashboard',
      onPress: () => router.push('/live-dashboard'),
    },
    {
      title: 'Reports & Analytics',
      icon: 'chart-bar',
      onPress: () => router.push('/reports'),
    },
    {
      title: 'Printer Management',
      icon: 'printer-settings',
      onPress: () => router.push('/printer-management'),
    },
    {
      title: 'Inventory',
      icon: 'warehouse',
      onPress: () => router.push('/inventory'),
    },
    {
      title: 'Employees',
      icon: 'account-group',
      onPress: () => {},
    },
    {
      title: 'Expenses',
      icon: 'cash',
      onPress: () => {},
    },
    {
      title: 'Settings',
      icon: 'cog',
      onPress: () => {},
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>More</Text>
      </View>

      <View style={styles.userCard}>
        <View style={styles.userAvatar}>
          <MaterialCommunityIcons
            name="account-circle"
            size={60}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{user?.name || 'User'}</Text>
          <Text style={styles.userRole}>{user?.role || 'Staff'}</Text>
        </View>
      </View>

      <ScrollView style={styles.menuList}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <MaterialCommunityIcons
              name={item.icon as any}
              size={24}
              color={theme.colors.text}
            />
            <Text style={styles.menuItemText}>{item.title}</Text>
            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <MaterialCommunityIcons
            name="logout"
            size={24}
            color={theme.colors.danger}
          />
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
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
    padding: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    margin: theme.spacing.md,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  userAvatar: {
    marginRight: theme.spacing.md,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: theme.fontSize.lg,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  userRole: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  menuList: {
    flex: 1,
    paddingHorizontal: theme.spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.sm,
  },
  menuItemText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.text,
    marginLeft: theme.spacing.md,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.sm,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
    borderWidth: 1,
    borderColor: theme.colors.danger,
  },
  logoutButtonText: {
    flex: 1,
    fontSize: theme.fontSize.md,
    color: theme.colors.danger,
    marginLeft: theme.spacing.md,
    fontWeight: '600',
  },
});
