/**
 * Loading Screen
 * Branded loading state shown during initial connection check
 */

import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../constants';

export function LoadingScreen(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Co-Op</Text>
      <ActivityIndicator size="large" color={COLORS.dark.foreground} style={styles.spinner} />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.dark.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  logo: {
    fontSize: 48,
    fontWeight: '600',
    color: COLORS.dark.foreground,
    marginBottom: 32,
  },
  spinner: {
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    color: COLORS.dark.mutedForeground,
  },
});
