/**
 * Connection State Hook
 * Manages network connectivity and server availability
 */

import { useState, useCallback } from 'react';
import { WEB_URL, CONNECTION_TIMEOUT_MS } from '../constants';

export type ConnectionState = 'loading' | 'connected' | 'offline' | 'error';

interface UseConnectionReturn {
  state: ConnectionState;
  errorMessage: string;
  checkConnection: () => Promise<void>;
}

export function useConnection(): UseConnectionReturn {
  const [state, setState] = useState<ConnectionState>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  const checkConnection = useCallback(async () => {
    setState('loading');
    setErrorMessage('');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT_MS);

    try {
      const response = await fetch(WEB_URL, {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });

      clearTimeout(timeout);

      if (response.ok) {
        setState('connected');
      } else {
        setErrorMessage(`Server returned ${response.status}`);
        setState('error');
      }
    } catch (error) {
      clearTimeout(timeout);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          setErrorMessage('Connection timed out');
          setState('error');
        } else {
          setState('offline');
        }
      } else {
        setState('offline');
      }
    }
  }, []);

  return { state, errorMessage, checkConnection };
}
