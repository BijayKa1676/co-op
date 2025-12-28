/**
 * WebView Screen
 * WebView wrapper with OAuth handling, theme detection, and full web ecosystem support
 */

import React, { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { StyleSheet, Linking, AppState, Platform, KeyboardAvoidingView } from 'react-native';
import { WebView } from 'react-native-webview';
import type { WebViewNavigation, WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import { useBackHandler, useDeepLink } from '../hooks';
import { shouldOpenExternally, isAllowedUrl, deepLinkToWebUrl, isAuthDeepLink } from '../utils';
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
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useBackHandler(webViewRef, canGoBack);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && webViewRef.current) {
        webViewRef.current.clearCache?.(false);
      }
      
      if (nextAppState === 'active' && webViewRef.current) {
        console.log('[WebView] App came to foreground');
        
        const checkAuthScript = `
          (function() {
            var currentPath = window.location.pathname;
            if (currentPath === '/login' || currentPath === '/') {
              var keys = Object.keys(localStorage);
              for (var i = 0; i < keys.length; i++) {
                if (keys[i].includes('supabase') && keys[i].includes('auth')) {
                  try {
                    var data = JSON.parse(localStorage.getItem(keys[i]));
                    if (data && data.access_token) {
                      window.location.href = '/dashboard';
                      return;
                    }
                  } catch(e) {}
                }
              }
            }
          })();
          true;
        `;
        
        setTimeout(() => {
          webViewRef.current?.injectJavaScript(checkAuthScript);
        }, 500);
      }
    });
    return () => subscription.remove();
  }, []);

  const handleDeepLink = useCallback((url: string) => {
    console.log('[WebView] Deep link received:', url);
    
    const webUrl = deepLinkToWebUrl(url);
    console.log('[WebView] Converted to:', webUrl);
    
    if (webUrl) {
      if (isAuthDeepLink(url)) {
        console.log('[WebView] Auth callback, forcing fresh load');
      }
      
      setTargetUrl(webUrl);
      setWebViewKey(k => k + 1);
      
      setTimeout(() => {
        webViewRef.current?.injectJavaScript(`
          window.location.href = '${webUrl}';
          true;
        `);
      }, 100);
    }
  }, []);

  useDeepLink(handleDeepLink);

  const injectedCSSScript = useMemo(() => {
    const top = insets.top;
    const bottom = insets.bottom;
    
    return `(function(){
      document.documentElement.style.setProperty('--safe-area-top', '${top}px');
      document.documentElement.style.setProperty('--safe-area-bottom', '${bottom}px');
      if (!document.documentElement.classList.contains('mobile-app')) {
        document.documentElement.classList.add('mobile-app');
      }
    })();true;`;
  }, [insets.top, insets.bottom]);


  const injectedPostLoadScript = useMemo(() => {
    const delay = THEME_DETECTION_DELAY_MS;
    
    return `(function(){
      if(window.__COOP_POSTLOAD_INJECTED__) return;
      window.__COOP_POSTLOAD_INJECTED__ = true;
      
      function detectTheme(){
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:"theme",
          isDark:document.documentElement.classList.contains("dark")
        }));
      }
      setTimeout(detectTheme, ${delay});
      new MutationObserver(detectTheme).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"]
      });
      
      document.addEventListener("touchstart", function(){}, {passive:true});
      document.addEventListener("touchmove", function(){}, {passive:true});
      
      if(window.location.pathname === "/" || window.location.pathname === ""){
        setTimeout(function(){
          var keys = Object.keys(localStorage);
          for(var i=0; i<keys.length; i++){
            if(keys[i].includes("supabase") && keys[i].includes("auth")){
              try{
                var data = JSON.parse(localStorage.getItem(keys[i]));
                if(data && data.access_token){
                  window.location.href = "/dashboard";
                  return;
                }
              }catch(e){}
            }
          }
        }, 500);
      }
      
      function reportNetworkStatus(){
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type:"network",
          online:navigator.onLine
        }));
      }
      window.addEventListener("online", reportNetworkStatus);
      window.addEventListener("offline", reportNetworkStatus);
      
      var lastHeight = window.innerHeight;
      window.addEventListener("resize", function(){
        var newHeight = window.innerHeight;
        if(newHeight < lastHeight - 100){
          setTimeout(function(){
            var el = document.activeElement;
            if(el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")){
              el.scrollIntoView({behavior:"smooth", block:"center"});
            }
          }, 100);
        }
        lastHeight = newHeight;
      });
    })();true;`;
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      switch (data.type) {
        case 'theme':
          if (typeof data.isDark === 'boolean') {
            setIsDarkMode(data.isDark);
          }
          break;
      }
    } catch {}
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

  const handleLoadEnd = useCallback(() => {
    webViewRef.current?.injectJavaScript(injectedCSSScript);
  }, [injectedCSSScript]);

  useEffect(() => {
    console.log('[WebView] State changed - targetUrl:', targetUrl, 'key:', webViewKey);
  }, [targetUrl, webViewKey]);

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack);
    
    if (isInitialLoad && navState.url) {
      setIsInitialLoad(false);
    }
    
    webViewRef.current?.injectJavaScript(injectedCSSScript);
  }, [isInitialLoad, injectedCSSScript]);

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
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
        onLoadEnd={handleLoadEnd}
        injectedJavaScriptBeforeContentLoaded={injectedCSSScript}
        injectedJavaScriptBeforeContentLoadedForMainFrameOnly
        injectedJavaScript={injectedPostLoadScript}
        injectedJavaScriptForMainFrameOnly
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowFileAccess
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        cacheEnabled
        cacheMode="LOAD_DEFAULT"
        startInLoadingState={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator
        scrollEnabled
        bounces
        overScrollMode="always"
        nestedScrollEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        mixedContentMode="compatibility"
        androidLayerType="hardware"
        setBuiltInZoomControls={false}
        setDisplayZoomControls={false}
        keyboardDisplayRequiresUserAction={false}
        hideKeyboardAccessoryView={false}
        applicationNameForUserAgent="CoOpMobile/1.0"
      />
    </KeyboardAvoidingView>
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
