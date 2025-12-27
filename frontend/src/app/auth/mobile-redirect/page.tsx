'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CircleNotch } from '@phosphor-icons/react';

function MobileRedirectContent() {
  const searchParams = useSearchParams();
  const [showManualButton, setShowManualButton] = useState(false);
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const expiresAt = searchParams.get('expires_at');

    let url: string;

    if (error) {
      url = `coop://auth/error?message=${encodeURIComponent(error)}`;
    } else if (accessToken && refreshToken) {
      const params = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt || '',
      });
      url = `coop://auth/callback#${params.toString()}`;
    } else {
      url = 'coop://auth/error?message=auth_failed';
    }

    setDeepLinkUrl(url);
    console.log('[MobileRedirect] Attempting deep link:', url);

    // Try to redirect immediately
    window.location.href = url;

    // Show manual button after a delay if redirect didn't work
    const timer = setTimeout(() => {
      setShowManualButton(true);
    }, 2000);

    return () => clearTimeout(timer);
  }, [searchParams]);

  const handleManualOpen = () => {
    if (deepLinkUrl) {
      window.location.href = deepLinkUrl;
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        {!showManualButton ? (
          <>
            <CircleNotch weight="bold" className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Opening Co-Op app...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium mb-2">Open in App</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Tap the button below to complete sign in
            </p>
            <button
              onClick={handleManualOpen}
              className="w-full bg-primary text-primary-foreground rounded-lg py-3 px-4 font-medium hover:bg-primary/90 transition-colors"
            >
              Open Co-Op App
            </button>
            <p className="text-xs text-muted-foreground mt-4">
              If the app doesn&apos;t open, make sure Co-Op is installed
            </p>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Mobile Redirect Page
 * 
 * This page receives tokens from the server callback and redirects to the mobile app
 * via deep link.
 */
export default function MobileRedirectPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <CircleNotch weight="bold" className="w-8 h-8 animate-spin text-primary" />
      </div>
    }>
      <MobileRedirectContent />
    </Suspense>
  );
}
