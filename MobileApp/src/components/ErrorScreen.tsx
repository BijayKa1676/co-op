/**
 * Error Screen
 * Optimized error/offline state with retry functionality
 */

import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Pressable } from 'react-native';
import { COLORS } from '../constants';

interface ErrorScreenProps {
  type: 'offline' | 'error';
  message?: string;
  onRetry: () => void;
}

function ErrorScreenComponent({ type, message, onRetry }: ErrorScreenProps): React.JSX.Element {
  const isOffline = type === 'offline';

  const handlePress = useCallback(() => {
    onRetry();
  }, [onRetry]);

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{isOffline ? '📡' : '⚠️'}</Text>
      <Text style={styles.title}>
        {isOffline ? 'No connection' : 'Something went wrong'}
      </Text>
      <Text style={styles.message}>
        {message || (isOffline
          ? 'Check your internet connection and try again.'
          : "We couldn't load the page. Please try again.")}
      </Text>
      <Pressable 
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed
        ]}
        onPress={handlePress}
        accessibilityRole="button"
        accessibilityLabel="Retry connection"
        android_ripple={{ color: 'rgba(0,0,0,0.2)', borderless: false }}
      >
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
    </View>
  );
}

// Memoize to prevent unnecessary re-renders
export const ErrorScreen = memo(ErrorScreenComponent);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 32,
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '500',
    color: COLORS.dark.foreground,
    marginBottom: 12,
    textAlign: 'center',
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'sans-serif-medium' },
    }),
  },
  message: {
    fontSize: 16,
    color: COLORS.dark.mutedForeground,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  button: {
    backgroundColor: COLORS.dark.foreground,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 160,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: COLORS.dark.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
