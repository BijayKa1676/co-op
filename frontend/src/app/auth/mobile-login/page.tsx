'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

/**
 * Mobile OAuth Login Page - Using Implicit Flow
 * 
 * This page handles Google OAuth for the mobile app using the IMPLICIT flow
 * instead of PKCE. The implicit flow returns tokens directly in the URL hash,
 * avoiding the need to persist a code verifier in localStorage (which can fail
 * in Chrome Custom Tabs on Android).
 * 
 * Flow:
 * 1. User taps "Continue with Google" in WebView
 * 2. WebView detects /auth/mobile-login and opens it in system browser
 * 3. This page initiates OAuth with implicit flow
 * 4. Google shows account picker → user authenticates
 * 5. Supabase redirects back with tokens in URL hash (#access_token=...&refresh_token=...)
 * 6. This page extracts tokens and triggers deep link coop://auth/callback?tokens...
 * 7. App receives deep link → WebView loads /auth/mobile-callback to set session
 */

function LoadingSpinner() {
  return <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />;
}

function MobileLoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'init' | 'redirecting' | 'processing' | 'success'>('init');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleAuth = async () => {
      // Check for error in URL params
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');
      
      if (errorParam) {
        const msg = errorDesc || errorParam;
        setError(msg);
        triggerDeepLink(`coop://auth/error?message=${encodeURIComponent(msg)}`);
        return;
      }

      // Check for tokens in URL hash (implicit flow returns tokens in hash)
      const hash = window.location.hash.substring(1);
      if (hash) {
        setStatus('processing');
        console.log('[MobileLogin] Processing hash fragment');
        
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const expiresAt = hashParams.get('expires_at');
        const errorInHash = hashParams.get('error');
        const errorDescInHash = hashParams.get('error_description');
        
        if (errorInHash) {
          const msg = errorDescInHash || errorInHash;
          setError(msg);
          triggerDeepLink(`coop://auth/error?message=${encodeURIComponent(msg)}`);
          return;
        }
        
        if (accessToken) {
          setStatus('success');
          console.log('[MobileLogin] Tokens found in hash, triggering deep link');
          
          const params = new URLSearchParams({
            access_token: accessToken,
            refresh_token: refreshToken || '',
            expires_at: expiresAt || '',
          });
          
          // Clear the hash for security
          window.history.replaceState(null, '', window.location.pathname);
          
          triggerDeepLink(`coop://auth/callback?${params.toString()}`);
          return;
        }
      }

      // Check for PKCE code (fallback for web flow)
      const code = searchParams.get('code');
      if (code) {
        setStatus('processing');
        console.log('[MobileLogin] PKCE code found, attempting exchange');
        
        // Try to exchange the code - this might fail if code verifier is missing
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        
        // Use createClient with implicit flow type
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: {
            flowType: 'pkce',
            autoRefreshToken: false,
            persistSession: true,
            detectSessionInUrl: false,
          }
        });
        
        try {
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          
          if (exchangeError) {
            console.error('[MobileLogin] Code exchange failed:', exchangeError.message);
            setError(exchangeError.message);
            triggerDeepLink(`coop://auth/error?message=${encodeURIComponent(exchangeError.message)}`);
            return;
          }

          if (data.session) {
            setStatus('success');
            console.log('[MobileLogin] Session obtained via PKCE');
            
            const params = new URLSearchParams({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: String(data.session.expires_at || ''),
            });
            
            triggerDeepLink(`coop://auth/callback?${params.toString()}`);
            return;
          }
        } catch (err) {
          console.error('[MobileLogin] Exchange error:', err);
        }
        
        // If PKCE failed, redirect to error
        setError('Authentication failed. Please try again.');
        triggerDeepLink('coop://auth/error?message=pkce_failed');
        return;
      }

      // No tokens or code - initiate OAuth with implicit flow
      setStatus('redirecting');
      console.log('[MobileLogin] Starting OAuth with implicit flow');
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      
      // Create client with implicit flow to avoid PKCE issues
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: {
          flowType: 'implicit',
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        }
      });
      
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/mobile-login`,
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (oauthError) {
        console.error('[MobileLogin] OAuth error:', oauthError.message);
        setError(oauthError.message);
        triggerDeepLink(`coop://auth/error?message=${encodeURIComponent(oauthError.message)}`);
        return;
      }

      if (data.url) {
        console.log('[MobileLogin] Redirecting to Google');
        window.location.href = data.url;
      }
    };

    handleAuth();
  }, [searchParams]);

  const triggerDeepLink = (url: string) => {
    console.log('[MobileLogin] Triggering deep link:', url);
    setTimeout(() => {
      window.location.href = url;
    }, 500);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <p className="text-destructive mb-4">{error}</p>
          <p className="text-muted-foreground text-sm mb-4">Returning to app...</p>
          <a href="coop://auth/error?message=auth_failed" className="text-primary hover:underline font-medium">
            Tap here if not redirected
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4">
          <LoadingSpinner />
        </div>
        <p className="text-muted-foreground">
          {status === 'init' && 'Initializing...'}
          {status === 'redirecting' && 'Connecting to Google...'}
          {status === 'processing' && 'Completing sign in...'}
          {status === 'success' && 'Opening app...'}
        </p>
      </div>
    </div>
  );
}

export default function MobileLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner />
      </div>
    }>
      <MobileLoginContent />
    </Suspense>
  );
}
