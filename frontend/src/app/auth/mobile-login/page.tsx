'use client';

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import Link from 'next/link';

/**
 * Mobile OAuth Login Page - Using Implicit Flow
 * 
 * Handles Google OAuth for mobile app using implicit flow to avoid
 * PKCE localStorage persistence issues in Chrome Custom Tabs.
 */

function MobileLoginContent() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'init' | 'redirecting' | 'processing' | 'success'>('init');
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;
    processedRef.current = true;

    const handleAuth = async () => {
      const errorParam = searchParams.get('error');
      const errorDesc = searchParams.get('error_description');
      
      if (errorParam) {
        const msg = errorDesc || errorParam;
        setError(msg);
        triggerDeepLink(`coop://auth/error?message=${encodeURIComponent(msg)}`);
        return;
      }

      // Check for tokens in URL hash (implicit flow)
      const hash = window.location.hash.substring(1);
      if (hash) {
        setStatus('processing');
        
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
          
          const params = new URLSearchParams({
            access_token: accessToken,
            refresh_token: refreshToken || '',
            expires_at: expiresAt || '',
          });
          
          window.history.replaceState(null, '', window.location.pathname);
          triggerDeepLink(`coop://auth/callback?${params.toString()}`);
          return;
        }
      }

      // Check for PKCE code (fallback)
      const code = searchParams.get('code');
      if (code) {
        setStatus('processing');
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        
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
            setError(exchangeError.message);
            triggerDeepLink(`coop://auth/error?message=${encodeURIComponent(exchangeError.message)}`);
            return;
          }

          if (data.session) {
            setStatus('success');
            
            const params = new URLSearchParams({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
              expires_at: String(data.session.expires_at || ''),
            });
            
            triggerDeepLink(`coop://auth/callback?${params.toString()}`);
            return;
          }
        } catch {
          // PKCE failed
        }
        
        setError('Authentication failed. Please try again.');
        triggerDeepLink('coop://auth/error?message=auth_failed');
        return;
      }

      // Initiate OAuth with implicit flow
      setStatus('redirecting');
      
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
      
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
            prompt: 'consent select_account', // Force consent + account selection
          },
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        triggerDeepLink(`coop://auth/error?message=${encodeURIComponent(oauthError.message)}`);
        return;
      }

      if (data.url) {
        window.location.href = data.url;
      }
    };

    handleAuth();
  }, [searchParams]);

  const triggerDeepLink = (url: string) => {
    setTimeout(() => {
      window.location.href = url;
    }, 500);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Link href="/" className="mb-8">
          <span className="font-serif text-2xl font-semibold tracking-tight">Co-Op</span>
        </Link>
        
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="font-serif text-xl font-medium mb-2">Authentication Failed</h2>
          <p className="text-muted-foreground text-sm mb-6">{error}</p>
          <p className="text-muted-foreground/60 text-xs mb-4">Returning to app...</p>
          <a 
            href="coop://auth/error?message=auth_failed" 
            className="text-sm text-primary hover:underline"
          >
            Tap here if not redirected
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <Link href="/" className="mb-8">
        <span className="font-serif text-2xl font-semibold tracking-tight">Co-Op</span>
      </Link>
      
      <div className="w-full max-w-sm text-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-5" />
        <p className="text-muted-foreground text-sm">
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <span className="font-serif text-2xl font-semibold tracking-tight mb-8">Co-Op</span>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MobileLoginContent />
    </Suspense>
  );
}
