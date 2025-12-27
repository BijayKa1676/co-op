/**
 * Deep Link Handler
 * Handles app scheme and universal links for OAuth callbacks
 */

import { useEffect, useRef } from 'react';
import { Linking, AppState, AppStateStatus } from 'react-native';

export function useDeepLink(onDeepLink: (url: string) => void): void {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    // Handle deep link when app is already open
    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      if (url) {
        onDeepLink(url);
      }
    });

    // Handle deep link when app is opened from closed state
    Linking.getInitialURL().then((url) => {
      if (url) {
        onDeepLink(url);
      }
    });

    // Re-check for deep links when app comes to foreground
    // This handles OAuth callbacks that might have been missed
    const appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        Linking.getInitialURL().then((url) => {
          if (url) {
            onDeepLink(url);
          }
        });
      }
      appState.current = nextAppState;
    });

    return () => {
      linkSubscription.remove();
      appStateSubscription.remove();
    };
  }, [onDeepLink]);
}
