# Co-Op Mobile App

<p>
  <img src="https://img.shields.io/badge/Expo-54-000020?logo=expo" alt="Expo">
  <img src="https://img.shields.io/badge/React_Native-0.76-61dafb?logo=react" alt="React Native">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Platform-iOS%20%7C%20Android-lightgrey" alt="Platform">
</p>

Native mobile application for the Co-Op AI advisory platform. Built with Expo SDK 54 and React Native, wrapping the web app with native features and OAuth support.

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm start
```

Scan the QR code with Expo Go (Android) or Camera app (iOS).

## Features

| Feature | Description |
|---------|-------------|
| **WebView Wrapper** | Native container for Co-Op web app |
| **OAuth Support** | Google auth via system browser |
| **Deep Linking** | `coop://` scheme + universal links |
| **Theme Sync** | Status bar matches website light/dark mode |
| **Offline Handling** | Connection detection with retry UI |
| **Back Navigation** | Android hardware back button support |
| **Edge-to-Edge** | Full screen with safe area padding injection |
| **URL Security** | Allowlisted domains only |

## Project Structure

```
MobileApp/
├── App.tsx                    # Entry point with SafeAreaProvider
├── app.json                   # Expo configuration
├── package.json               # Dependencies (Expo SDK 54)
├── tsconfig.json              # TypeScript configuration
└── src/
    ├── components/            # UI components
    │   ├── LoadingScreen.tsx  # Branded loading state
    │   ├── ErrorScreen.tsx    # Offline/error states
    │   └── WebViewScreen.tsx  # Main WebView with OAuth
    ├── constants/             # App configuration
    │   └── config.ts          # URLs, colors, domains
    ├── hooks/                 # Custom React hooks
    │   ├── useConnection.ts   # Network state management
    │   ├── useBackHandler.ts  # Android back button
    │   └── useDeepLink.ts     # Deep link handling
    ├── screens/               # Screen components
    │   └── MainScreen.tsx     # Orchestrates app screens
    └── utils/                 # Utility functions
        └── url.ts             # URL validation, deep links
```

## OAuth Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Mobile App │────▶│   System    │────▶│   OAuth     │
│  (WebView)  │     │   Browser   │     │  Provider   │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │                                       ▼
       │            ┌─────────────┐     ┌─────────────┐
       └────────────│  Deep Link  │◀────│   Backend   │
                    │  coop://    │     │  Callback   │
                    └─────────────┘     └─────────────┘
```

1. User taps "Sign in with Google"
2. App opens system browser (required by Google OAuth)
3. User completes authentication
4. Backend redirects to `coop://dashboard`
5. App catches deep link and loads authenticated session

## Configuration

### Deep Linking

| Type | URL |
|------|-----|
| Custom Scheme | `coop://` |
| Universal Link | `https://co-op-dev.vercel.app/auth/callback` |

### Allowed Domains

```typescript
// src/constants/config.ts
export const ALLOWED_DOMAINS = [
  'co-op-dev.vercel.app',
  'accounts.google.com',
  'supabase.co',
];
```

## Building for Production

### Prerequisites

- Node.js 20+
- Expo account
- Apple Developer account (iOS)
- Google Play Console account (Android)

### Build Commands

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build for Android (APK)
eas build --platform android --profile preview

# Build for Android (Play Store)
eas build --platform android --profile production

# Build for iOS (TestFlight)
eas build --platform ios --profile production
```

### App Store Configuration

| Platform | Bundle ID |
|----------|-----------|
| iOS | `com.coop.mobile` |
| Android | `com.coop.mobile` |

## Security

| Feature | Implementation |
|---------|----------------|
| URL Allowlisting | Only trusted domains can load |
| OAuth via Browser | System browser for auth (not WebView) |
| No Local Storage | Auth handled by web cookies |
| Minimal JS Injection | Read-only theme detection |

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Expo SDK 54 |
| Runtime | React Native 0.76 |
| Language | TypeScript 5 |
| WebView | react-native-webview |
| Navigation | expo-linking |
| Network | @react-native-community/netinfo |

## Scripts

```bash
npm start            # Start Expo dev server
npm run android      # Run on Android
npm run ios          # Run on iOS
npm run lint         # Run ESLint
npm run typecheck    # TypeScript checking
```

## License

MIT License - see [LICENSE](../LICENSE) for details.
