# Building Android APK

## Prerequisites
- EAS CLI installed (`npm install -g eas-cli` or use `npx eas-cli`)
- Expo account (free account works)

## Steps to Build APK

### 1. Login to Expo (if needed)
```bash
npx eas-cli login
```
You'll be prompted to create an account or sign in. Check with:
```bash
npx eas-cli whoami
```

### 2. Build Production APK (for distribution)
From the project root (`AgriculturalDiagnosis`):
```bash
cd AgriculturalDiagnosis
npx eas-cli build --platform android --profile production
```
- **First time:** When asked about Android credentials, choose **Generate new keystore** (Expo will create and store it for you).
- Build runs on Expo's servers; you get a download link when it finishes.

### 3. Build Preview APK (for testing)
For a test APK you can install directly:
```bash
npx eas-cli build --platform android --profile preview
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

