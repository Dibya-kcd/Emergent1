import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useAuthStore } from '../stores/authStore';
import { theme } from '../constants/theme';

export default function LoginScreen() {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((state) => state.login);

  const handleLogin = async () => {
    if (pin.length < 4) {
      Alert.alert('Error', 'Please enter a valid PIN');
      return;
    }

    setLoading(true);
    const success = await login(pin);
    setLoading(false);

    if (!success) {
      Alert.alert('Error', 'Invalid PIN. Please try again.');
      setPin('');
    }
  };

  const addDigit = (digit: string) => {
    if (pin.length < 6) {
      setPin(pin + digit);
    }
  };

  const removeDigit = () => {
    setPin(pin.slice(0, -1));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>RestoPOS</Text>
        <Text style={styles.subtitle}>Enter your PIN to continue</Text>

        <View style={styles.pinDisplay}>
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <View
              key={index}
              style={[
                styles.pinDot,
                index < pin.length && styles.pinDotFilled,
              ]}
            />
          ))}
        </View>

        <View style={styles.numpad}>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <TouchableOpacity
              key={num}
              style={styles.numButton}
              onPress={() => addDigit(num.toString())}
            >
              <Text style={styles.numButtonText}>{num}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.numButton}
            onPress={removeDigit}
          >
            <Text style={styles.numButtonText}>←</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.numButton}
            onPress={() => addDigit('0')}
          >
            <Text style={styles.numButtonText}>0</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.numButton, styles.loginButton]}
            onPress={handleLogin}
            disabled={loading || pin.length === 0}
          >
            <Text style={styles.loginButtonText}>✓</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Demo PIN: 1234</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing.lg,
  },
  title: {
    fontSize: theme.fontSize.xxl,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.fontSize.md,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.xl,
  },
  pinDisplay: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  pinDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  pinDotFilled: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  numpad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    gap: theme.spacing.md,
  },
  numButton: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  numButtonText: {
    fontSize: theme.fontSize.xl,
    fontWeight: '600',
    color: theme.colors.text,
  },
  loginButton: {
    backgroundColor: theme.colors.primary,
  },
  loginButtonText: {
    fontSize: theme.fontSize.xl,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  hint: {
    marginTop: theme.spacing.xl,
    fontSize: theme.fontSize.sm,
    color: theme.colors.textSecondary,
  },
});
