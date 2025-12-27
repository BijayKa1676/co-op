/**
 * Error Screen
 * Displays offline/error states with retry functionality
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

interface ErrorScreenProps {
  type: 'offline' | 'error';
  message?: string;
  onRetry: () => void;
}

export function ErrorScreen({ type, message, onRetry }: ErrorScreenProps): React.JSX.Element {
  const isOffline = type === 'offline';

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
      <TouchableOpacity 
        style={styles.button} 
        onPress={onRetry} 
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Retry connection"
      >
        <Text style={styles.buttonText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

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
  buttonText: {
    color: COLORS.dark.background,
    fontSize: 16,
    fontWeight: '600',
  },
});
