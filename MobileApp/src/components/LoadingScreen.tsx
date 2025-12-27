/**
 * Loading Screen
 * Lightweight loading state optimized for fast rendering
 */

import React, { memo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { COLORS } from '../constants';

function LoadingScreenComponent(): React.JSX.Element {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>Co-Op</Text>
      <ActivityIndicator 
        size="large" 
        color={COLORS.dark.foreground} 
        style={styles.spinner}
      />
      <Text style={styles.text}>Loading...</Text>
    </View>
  );
}

// Memoize to prevent unnecessary re-renders
export const LoadingScreen = memo(LoadingScreenComponent);

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
    // GPU acceleration for text
    ...Platform.select({
      ios: { fontFamily: 'System' },
      android: { fontFamily: 'sans-serif-medium' },
    }),
  },
  spinner: {
    marginBottom: 16,
  },
  text: {
    fontSize: 16,
    color: COLORS.dark.mutedForeground,
  },
});
