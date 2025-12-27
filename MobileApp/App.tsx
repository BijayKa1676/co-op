/**
 * Co-Op Mobile App
 * React Native wrapper for the Co-Op web application
 */

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { MainScreen } from './src/screens';

export default function App(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <MainScreen />
    </SafeAreaProvider>
  );
}
