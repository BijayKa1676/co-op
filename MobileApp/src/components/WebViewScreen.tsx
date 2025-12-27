/**
 * WebView Screen
 * Main WebView wrapper with OAuth handling, theme detection, and deep linking
 */

import React, { useRef, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Linking } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useBackHandler, useDeepLink } from '../hooks';
import { shouldOpenExternally, isAllowedUrl, deepLinkToWebUrl } from '../utils';
import { WEB_URL, THEME_DETECTION_DELAY_MS } from '../constants';

interface WebViewScreenProps {
  onError: () => void;
}

export function WebViewScreen({ onError }: WebViewScreenProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0);
  const [targetUrl, setTargetUrl] = useState(WEB_URL);

  useBackHandler(webViewRef, canGoBack);

  // Handle deep links (OAuth callbacks)
  const handleDeepLink = useCallback((url: string) => {
    const webUrl = deepLinkToWebUrl(url);
    if (webUrl) {
      setTargetUrl(webUrl);
      // Force WebView reload with new URL
      setWebViewKey(prev => prev + 1);
    }
  }, []);

  useDeepLink(handleDeepLink);

  // Injected JavaScript for safe area padding and theme detection
  const injectedScript = useMemo(() => `
    (function() {
      'use strict';
      
      // Add safe area padding
      var style = document.createElement('style');
      style.id = 'mobile-app-styles';
      style.textContent = 'body { padding-top: ${insets.top}px !important; }';
      document.head.appendChild(style);
      
      // Theme detection
      function detectTheme() {
        var isDark = document.documentElement.classList.contains('dark');
        window.ReactNativeWebView.postMessage(JSON.stringify({ 
          type: 'theme', 
          isDark: isDark
        }));
      }
      
      // Initial detection with delay for styles to load
      setTimeout(detectTheme, ${THEME_DETECTION_DELAY_MS});
      
      // Watch for theme changes
      var observer = new MutationObserver(detectTheme);
      observer.observe(document.documentElement, { 
        attributes: true, 
        attributeFilter: ['class'] 
      });
    })();
    true;
  `, [insets.top]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'theme' && typeof data.isDark === 'boolean') {
        setIsDarkMode(data.isDark);
      }
    } catch {
      // Silently ignore malformed messages
    }
  }, []);

  // Security: Intercept navigation requests
  const handleShouldStartLoadWithRequest = useCallback((request: { url: string }): boolean => {
    const { url } = request;
    
    // Open OAuth URLs in external browser
    if (shouldOpenExternally(url)) {
      Linking.openURL(url).catch(() => {
        // Silently fail if can't open URL
      });
      return false;
    }
    
    // Security: Only allow navigation to approved domains
    if (!isAllowedUrl(url)) {
      // Open unknown URLs in external browser
      Linking.openURL(url).catch(() => {});
      return false;
    }
    
    return true;
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar 
        style={isDarkMode ? 'light' : 'dark'} 
        translucent 
        backgroundColor="transparent" 
      />
      <WebView
        key={webViewKey}
        ref={webViewRef}
        source={{ uri: targetUrl }}
        style={styles.webview}
        onNavigationStateChange={handleNavigationStateChange}
        onMessage={handleMessage}
        onError={onError}
        onHttpError={onError}
        onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
        injectedJavaScript={injectedScript}
        // Core settings
        javaScriptEnabled={true}
        domStorageEnabled={true}
        // Cookie settings for auth persistence
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        // UX enhancements
        allowsBackForwardNavigationGestures={true}
        pullToRefreshEnabled={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Security
        javaScriptCanOpenWindowsAutomatically={false}
        // Performance
        cacheEnabled={true}
        incognito={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
});
