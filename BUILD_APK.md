# Building Android APK

## Prerequisites
- EAS CLI installed ✅
- Expo account (free account works)

## Steps to Build APK

### 1. Login to Expo
```bash
eas login
```
You'll be prompted to create an account or login if you don't have one.

### 2. Build APK (Preview/Development)
For a test APK that you can install directly:
```bash
eas build --platform android --profile preview
```

### 3. Build Production APK
For a production-ready APK:
```bash
eas build --platform android --profile production
```

## Build Options

### Local Build (Faster, requires Android SDK)
If you have Android Studio installed:
```bash
eas build --platform android --profile preview --local
```

### Cloud Build (Recommended)
Uses Expo's servers (no local setup needed):
```bash
eas build --platform android --profile preview
```

## After Build

1. The build will take 10-20 minutes
2. You'll get a download link when it's complete
3. Download the APK file
4. Install on Android device by enabling "Install from Unknown Sources"

## Notes

- **Package Name**: `com.buair.agrisense`
- **Version**: 1.0.0
- **Build Type**: APK (installable file)

## Troubleshooting

If you encounter issues:
1. Make sure you're logged in: `eas whoami`
2. Check build status: `eas build:list`
3. View build logs: `eas build:view [BUILD_ID]`

