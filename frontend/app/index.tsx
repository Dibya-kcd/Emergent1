import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';
import LoginScreen from '../src/screens/LoginScreen';
import { theme } from '../src/constants/theme';

export default function Index() {
  const { isAuthenticated } = useAuthStore();

  // If authenticated, redirect to tabs
  if (isAuthenticated) {
    return <Redirect href="/(tabs)/menu" />;
  }

  // Otherwise show login
  return (
    <View style={styles.container}>
      <LoginScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
});
