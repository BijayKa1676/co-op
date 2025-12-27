/**
 * Main Screen
 * Orchestrates app state: loading, error, or WebView
 */

import React, { useEffect, useCallback } from 'react';
import { LoadingScreen, ErrorScreen, WebViewScreen } from '../components';
import { useConnection } from '../hooks';

export function MainScreen(): React.JSX.Element {
  const { state, errorMessage, checkConnection } = useConnection();

  useEffect(() => {
    checkConnection();
  }, [checkConnection]);

  const handleRetry = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  const handleWebViewError = useCallback(() => {
    checkConnection();
  }, [checkConnection]);

  switch (state) {
    case 'loading':
      return <LoadingScreen />;
    case 'offline':
      return <ErrorScreen type="offline" onRetry={handleRetry} />;
    case 'error':
      return <ErrorScreen type="error" message={errorMessage} onRetry={handleRetry} />;
    case 'connected':
      return <WebViewScreen onError={handleWebViewError} />;
  }
}
