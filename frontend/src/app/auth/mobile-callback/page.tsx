'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { api } from '@/lib/api/client';
import { CircleNotch } from '@phosphor-icons/react';

type CallbackState = 'loading' | 'error' | 'success';

/**
 * Mobile OAuth Callback Page
 * 
 * Receives OAuth tokens via URL fragment from mobile app deep link
 * and establishes the Supabase session in the WebView context.
 */
export default function MobileCallbackPage() {
  const router = useRouter();
  const [state, setState] = useState<CallbackState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const hasProcessed = useRef(false);

  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;

    const handleCallback = async () => {
      const supabase = createClient();
      
      try {
        // Get tokens from URL fragment
        const hash = window.location.hash.substring(1);
        const fullUrl = window.location.href;
        
        console.log('[MobileCallback] Processing callback');
        console.log('[MobileCallback] Full URL:', fullUrl);
        console.log('[MobileCallback] Hash:', hash);
        setDebugInfo(`URL: ${fullUrl.substring(0, 100)}...`);
        
        // Handle error in hash
        if (hash.includes('error=')) {
          const params = new URLSearchParams(hash);
          const errorMsg = params.get('error_description') || params.get('error') || 'Authentication failed';
          console.error('[MobileCallback] Error in hash:', errorMsg);
          setError(errorMsg);
          setState('error');
          return;
        }
        
        if (!hash) {
          console.error('[MobileCallback] No hash fragment found');
          setError('No authentication data received. Please try signing in again.');
          setState('error');
          return;
        }

        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        const expires_at = params.get('expires_at');

        console.log('[MobileCallback] Tokens found:', {
          hasAccessToken: !!access_token,
          hasRefreshToken: !!refresh_token,
          expiresAt: expires_at,
        });

        if (!access_token || !refresh_token) {
          console.error('[MobileCallback] Missing tokens');
          setError('Invalid authentication data. Please try signing in again.');
          setState('error');
          return;
        }

        // Check token expiry
        if (expires_at) {
          const expiresAtMs = parseInt(expires_at) * 1000;
          if (Date.now() > expiresAtMs) {
            console.error('[MobileCallback] Token expired');
            setError('Session expired. Please sign in again.');
            setState('error');
            return;
          }
        }

        // Clear existing session
        const { data: existingSession } = await supabase.auth.getSession();
        if (existingSession?.session) {
          console.log('[MobileCallback] Clearing existing session');
          await supabase.auth.signOut({ scope: 'local' });
        }

        // Set the new session
        console.log('[MobileCallback] Setting new session...');
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token,
          refresh_token,
        });

        if (sessionError) {
          console.error('[MobileCallback] Session error:', sessionError);
          setError(sessionError.message);
          setState('error');
          return;
        }

        if (!data.session || !data.user) {
          console.error('[MobileCallback] No session/user in response');
          setError('Failed to establish session. Please try again.');
          setState('error');
          return;
        }

        console.log('[MobileCallback] Session set successfully, user:', data.user.email);

        // Clear URL hash for security
        window.history.replaceState(null, '', '/auth/mobile-callback');

        // Verify session is stored
        const { data: verifySession } = await supabase.auth.getSession();
        console.log('[MobileCallback] Session verification:', !!verifySession.session);

        if (!verifySession.session) {
          console.error('[MobileCallback] Session not persisted');
          setError('Session was not saved. Please try again.');
          setState('error');
          return;
        }

        // Check onboarding status
        let needsOnboarding = true;
        try {
          const status = await api.getOnboardingStatus();
          needsOnboarding = !status.completed;
          console.log('[MobileCallback] Onboarding status:', status);
        } catch (apiError) {
          console.warn('[MobileCallback] API check failed, using metadata');
          const userMeta = data.user.user_metadata || {};
          needsOnboarding = !userMeta.onboarding_completed;
        }

        setState('success');

        // Small delay then redirect
        await new Promise(resolve => setTimeout(resolve, 300));

        const destination = needsOnboarding ? '/onboarding' : '/dashboard';
        console.log('[MobileCallback] Redirecting to:', destination);
        
        // Use window.location for full navigation to ensure cookies are sent
        window.location.href = destination;
      } catch (err) {
        console.error('[MobileCallback] Unexpected error:', err);
        setError('Authentication failed. Please try again.');
        setState('error');
      }
    };

    handleCallback();
  }, [router]);

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-destructive mb-2">{error}</p>
          <p className="text-xs text-muted-foreground mb-4">{debugInfo}</p>
          <button
            onClick={() => window.location.href = '/login'}
            className="text-primary hover:underline font-medium"
          >
            Return to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <CircleNotch weight="bold" className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground">
          {state === 'success' ? 'Redirecting...' : 'Completing sign in...'}
        </p>
        <p className="text-xs text-muted-foreground mt-2">{debugInfo}</p>
      </div>
    </div>
  );
}
