/**
 * WebView Screen
 * WebView wrapper with OAuth handling and theme detection
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { View, StyleSheet, Linking, AppState } from 'react-native';
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && webViewRef.current) {
        webViewRef.current.clearCache?.(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const handleDeepLink = useCallback((url: string) => {
    const webUrl = deepLinkToWebUrl(url);
    if (webUrl) {
      setTargetUrl(webUrl);
      setWebViewKey(prev => prev + 1);
    }
  }, []);

  useDeepLink(handleDeepLink);

  const injectedScript = useMemo(() => {
    const top = insets.top;
    const delay = THEME_DETECTION_DELAY_MS;
    // Performance CSS + theme detection
    return `(function(){
      var s=document.createElement("style");
      s.textContent="body{padding-top:${top}px!important;-webkit-overflow-scrolling:touch!important}*{-webkit-tap-highlight-color:transparent}main,.overflow-auto,.overflow-y-auto{transform:translateZ(0)}";
      document.head.appendChild(s);
      function d(){window.ReactNativeWebView.postMessage(JSON.stringify({type:"theme",isDark:document.documentElement.classList.contains("dark")}));}
      setTimeout(d,${delay});
      new MutationObserver(d).observe(document.documentElement,{attributes:true,attributeFilter:["class"]});
      document.addEventListener("touchstart",function(){},{passive:true});
    })();true;`;
  }, [insets.top]);

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
      // Ignore
    }
  }, []);

  const handleShouldStartLoadWithRequest = useCallback((request: { url: string }): boolean => {
    const { url } = request;
    if (shouldOpenExternally(url)) {
      Linking.openURL(url).catch(() => {});
      return false;
    }
    if (!isAllowedUrl(url)) {
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
        // Core
        javaScriptEnabled
        domStorageEnabled
        // Auth persistence
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        // UX
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        allowsInlineMediaPlayback
        // Performance
        cacheEnabled
        startInLoadingState={false}
        // Scroll
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator
        // Security
        javaScriptCanOpenWindowsAutomatically={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f1012',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
