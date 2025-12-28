'use client';

import { useEffect, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

/**
 * Mobile Redirect Page
 * 
 * Fallback handler for OAuth redirects. Extracts tokens and triggers deep link.
 */

function MobileRedirectContent() {
  const searchParams = useSearchParams();
  const [showManual, setShowManual] = useState(false);
  const [deepLink, setDeepLink] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get('error') || searchParams.get('error_description');
    if (error) {
      const url = `coop://auth/error?message=${encodeURIComponent(error)}`;
      setDeepLink(url);
      window.location.href = url;
      setTimeout(() => setShowManual(true), 2000);
      return;
    }

    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    
    if (accessToken && refreshToken) {
      const params = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: searchParams.get('expires_at') || '',
      });
      const url = `coop://auth/callback?${params.toString()}`;
      setDeepLink(url);
      window.location.href = url;
      setTimeout(() => setShowManual(true), 2000);
      return;
    }

    const hash = window.location.hash.substring(1);
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const hashToken = hashParams.get('access_token');
      
      if (hashToken) {
        const params = new URLSearchParams({
          access_token: hashToken,
          refresh_token: hashParams.get('refresh_token') || '',
          expires_at: hashParams.get('expires_at') || '',
        });
        const url = `coop://auth/callback?${params.toString()}`;
        setDeepLink(url);
        window.location.href = url;
        setTimeout(() => setShowManual(true), 2000);
        return;
      }
    }

    const code = searchParams.get('code');
    if (code) {
      window.location.href = `/auth/mobile-login?code=${code}`;
      return;
    }

    const url = 'coop://auth/error?message=no_credentials';
    setDeepLink(url);
    window.location.href = url;
    setTimeout(() => setShowManual(true), 2000);
  }, [searchParams]);

  if (showManual && deepLink) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <Link href="/" className="mb-8">
          <span className="font-serif text-2xl font-semibold tracking-tight">Co-Op</span>
        </Link>
        
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="font-serif text-xl font-medium mb-2">Open in App</h2>
          <p className="text-muted-foreground text-sm mb-6">Tap the button below to return to the app</p>
          <button
            onClick={() => window.location.href = deepLink}
            className="w-full bg-primary text-primary-foreground rounded-lg py-3 px-4 text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Open Co-Op App
          </button>
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
        <p className="text-muted-foreground text-sm">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function MobileRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <span className="font-serif text-2xl font-semibold tracking-tight mb-8">Co-Op</span>
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <MobileRedirectContent />
    </Suspense>
  );
}
