# Agri-sense App Assessment

## 1. Splash screen – why the icon was missing and what was fixed

### Root cause

- **Two splash experiences**
  - **Native splash** (from `app.json` + `expo-splash-screen`): Uses `splash-icon.png` and `backgroundColor: #2E7D32`. This is shown as soon as the app process starts, before any JavaScript runs.
  - **In-app loading screen** (in `app/_layout.tsx`): Shown after JS loads, while `appIsReady` is false (~2 seconds). It was using a **generic leaf icon** (`MaterialCommunityIcons`) and “Agri-sense” text, **not** your branded `splash-icon.png`.

- **Why the icon seemed to disappear**
  - In **Expo Go**, the native splash often does **not** show your custom image; Expo Go can show its own or the app icon instead. So you mainly see the in-app screen.
  - The in-app screen was not using `splash-icon.png`, so you never saw the real logo (circle + leaf) during that phase.
  - In **development/preview builds**, if the native splash image path or format is wrong, only the green background can show.

### Fixes applied

1. **In-app loading screen now uses your splash image**
   - In `app/_layout.tsx`, the loading view now shows `splash-icon.png` (circle + leaf on green) via `<Image source={require('../assets/images/splash-icon.png')} />` instead of the generic leaf icon.
   - So whenever the app is “loading” (after native splash, before content), users see the same branded logo.

2. **Native splash (production builds)**
   - `app.json` is already set with `image: "./assets/images/splash-icon.png"`, `imageWidth: 300`, `resizeMode: "contain"`, `backgroundColor: "#2E7D32"`.
   - For **production/preview builds** (e.g. `eas build`), the native splash will use this image. To verify, test a built APK/IPA, not Expo Go.
   - Ensure `splash-icon.png` exists under `assets/images/` and is a valid PNG (e.g. 1024×1024). Regenerate it with `npm run generate-icons` if needed.

---

## 2. App weaknesses

### High priority

| Area | Issue | Recommendation |
|------|--------|-----------------|
| **API base URL** | Production API is HTTP and hardcoded (`http://147.93.116.6:8090`). Chat API uses an ngrok URL that will change. | Use HTTPS for production; move URLs to env (e.g. `EXPO_PUBLIC_*`) or EAS Secrets and reference in `api.ts`. |
| **Offline UX** | Many screens don’t check network before calling the API; users get generic errors or loading that never resolves. | Before heavy API use (diagnosis, chat, register, login), check `useNetworkStatus()` and show a clear “No internet” message or disable actions. |
| **Sensitive data** | Auth token is in SecureStore (good). API logs in dev can log URLs and flow. | Avoid logging tokens or full request/response bodies; strip in production. |
| **Error messages** | Some API errors are only logged or shown as a generic “Something went wrong”. | Map network/offline, 4xx/5xx, and timeouts to user-friendly, actionable messages (e.g. “No connection”, “Session expired”, “Server busy”). |

### Medium priority

| Area | Issue | Recommendation |
|------|--------|-----------------|
| **NetworkStatusBar** | Was only on chat, history, library. | Now added once in root `_layout.tsx` so the “No internet” bar appears on all screens. |
| **Caching** | Weather has 2-hour cache; diagnosis/spectroscopy/chat rely on API and context, no offline cache. | Consider caching last diagnosis/list and last chat for “view last result” when offline. |
| **Timeouts** | Diagnosis uses 3-minute timeout; login/register use shorter timeouts. | Document in UI that diagnosis can take a while; consider “still working” feedback for long requests. |
| **Input validation** | Phone validation exists; other forms (name, area, etc.) may allow empty or weak data. | Validate all required fields and lengths before calling API; show inline errors. |
| **Image upload** | Diagnosis sends base64; large images can cause memory/bandwidth issues. | Consider resizing/compression before upload and max dimension limits. |

### Lower priority

| Area | Issue | Recommendation |
|------|--------|-----------------|
| **Deep linking** | Scheme `agrisense` is set; actual routes may not be fully covered. | Test and document which routes open from links. |
| **Analytics/crashes** | No explicit crash or analytics SDK seen. | Add crash reporting (e.g. Sentry) and optional analytics for key flows. |
| **Accessibility** | Some `accessibilityLabel`s exist; not all interactive elements may be labeled. | Audit focus order and labels for screen readers. |
| **Localization** | Preferred language is stored; many strings are still hardcoded in English. | Move strings to `src/localization/strings.ts` (or similar) and use by locale. |

---

## 3. What happens when the app is offline

### Current behavior

- **Network detection**
  - `useNetworkStatus()` (NetInfo) is used to detect connectivity.
  - `NetworkStatusBar` is shown app-wide when offline (`!isConnected || isInternetReachable === false`) with “No internet connection”.

- **By feature**
  - **Login / Register**: API calls fail (e.g. network error or timeout). User sees error alerts (e.g. “Unable to connect to server…”). No offline mode for auth.
  - **Diagnosis**: Submit calls the backend; offline causes failure and retries (up to 2). User eventually sees an error; no offline queue.
  - **Chat (text/voice)**: Depends on external chat API. Offline requests fail; no queuing or offline history beyond what’s already in context.
  - **Weather (home)**: Uses Open-Meteo. Last result is cached (e.g. 2 hours in AsyncStorage). When offline, cached weather can still be shown; refresh fails silently or with an error.
  - **History / profile**: Load from API. Offline: lists and profile may not load or may show stale data from context; no dedicated offline cache layer.
  - **Spectroscopy**: Same as diagnosis – requires network; no offline support.

- **Data and state**
  - App state (profile, diagnosis/spectroscopy history, chat) is in memory and persisted (e.g. AsyncStorage) via `AppContext`. If the user never fetched while online, that data is empty when offline.
  - No explicit “offline mode” or queue: failed requests are not retried automatically when the connection returns.

### Recommendations for offline

1. **Show offline banner everywhere**  
   Done: `NetworkStatusBar` is in the root layout.

2. **Block or warn before online-only actions**  
   On diagnosis, chat send, login, register: if `!isConnected`, show a message like “You need an internet connection” and don’t start the request.

3. **Cache last results**  
   Cache last diagnosis result and last chat messages locally so users can at least view them when offline.

4. **Retry when back online**  
   Optional: when NetInfo reports connection restored, retry failed operations or show “Tap to retry” for key screens.

---

## Summary

- **Splash**: The missing icon was due to the in-app loading screen not using `splash-icon.png` and Expo Go not showing the native splash image. The in-app phase now shows `splash-icon.png`; native splash in production uses `app.json` and is best verified on a real build.
- **Weaknesses**: Focus on HTTPS/env for API URLs, clearer offline handling and errors, and consistent validation and error messaging.
- **Offline**: The app shows a global “No internet” bar and relies on API calls that fail when offline; weather can use cache. Improving pre-check and messaging for online-only actions and adding minimal offline caching will improve UX.
