# Agri-sense Mobile App

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-green.svg)
![Platform](https://img.shields.io/badge/platform-iOS%20%7C%20Android-blue.svg)
![React Native](https://img.shields.io/badge/React%20Native-0.81.5-61DAFB.svg)
![Expo](https://img.shields.io/badge/Expo-~54.0.23-000020.svg)

**AI-Powered Crop Disease Diagnosis and Agronomy Support Platform**

[Features](#-features) • [Installation](#-installation) • [Usage](#-usage) • [Architecture](#-architecture) • [API Integration](#-api-integration) • [Building](#-building)

</div>

---

## 📱 Overview

Agri-sense is a comprehensive mobile application designed to empower farmers with AI-driven crop disease diagnosis, spectroscopy analysis, and intelligent agronomy assistance. Built with React Native and Expo, the app provides real-time disease detection, weather forecasting, and multilingual support to help farmers make informed decisions about their crops.

### Key Capabilities

- **🔬 AI-Powered Disease Diagnosis**: Instant crop disease identification using machine learning
- **📊 Spectroscopy Analysis**: Advanced spectral data capture and analysis
- **💬 Intelligent Chat Assistant**: Voice and text-based agronomy support in multiple languages
- **🌤️ Weather Integration**: Real-time weather forecasts and agricultural insights
- **📈 Activity Tracking**: Comprehensive history and analytics dashboard
- **🌍 Multilingual Support**: Available in English, Luganda, Ateso, Japadhola, Swahili, and Runyankore

---

## ✨ Features

### 1. **Crop Disease Diagnosis**
- Capture or select crop images from gallery
- Real-time AI-powered disease detection using TensorFlow Lite
- Detailed diagnosis results with confidence scores
- Actionable treatment recommendations
- Image cropping and optimization for accurate analysis

### 2. **Spectroscopy Analysis**
- Capture spectral data from field samples
- Visualize spectrum graphs and signal strength
- Track spectroscopy history and trends
- Export and share analysis results

### 3. **AI Chat Assistant**
- **Text Chat**: Type questions and receive instant AI-powered responses
- **Voice Chat**: Record voice messages for hands-free interaction
- **Multilingual Support**: Communicate in your preferred language
- **Conversation History**: Access previous conversations and insights
- **Real-time Typing Indicators**: Enhanced user experience with live feedback

### 4. **Weather Dashboard**
- Current weather conditions with detailed metrics
- 5-hour hourly forecast
- 5-day extended forecast
- Location-based weather data
- Pull-to-refresh functionality
- Offline caching for last known weather

### 5. **User Profile & History**
- Comprehensive user profile management
- Activity statistics and analytics
- Diagnosis and spectroscopy history
- Timeline view of all activities
- Export and share capabilities

### 6. **Home Dashboard**
- Personalized greeting and quick stats
- Search functionality for quick access
- Weather carousel with multiple forecast views
- Quick navigation to key features
- Responsive and modern UI/UX

---

## 🚀 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Expo CLI** (installed globally or via npx)
- **iOS Simulator** (for macOS) or **Android Studio** (for Android development)
- **Expo Go** app (for physical device testing)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AgriSense
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables** (if needed)
   - Update API endpoints in `src/services/api.ts`
   - Configure backend URLs for production/development

4. **Start the development server**
   ```bash
   npx expo start
   ```

5. **Run on your preferred platform**
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Scan QR code with Expo Go app for physical device

---

## 📖 Usage

### Getting Started

1. **Registration/Login**
   - Create a new account or log in with existing credentials
   - Complete your profile with farm details and preferences

2. **Crop Diagnosis**
   - Navigate to the Diagnosis tab
   - Tap "Capture" to take a photo or "Gallery" to select an image
   - Crop and adjust the image as needed
   - Tap "Analyze" to get AI-powered diagnosis results
   - Review disease predictions, confidence scores, and recommendations

3. **Chat with AI Assistant**
   - Open the Chat tab
   - Type your question or tap the microphone icon for voice input
   - Receive instant AI-powered responses
   - Access conversation history anytime

4. **View Weather**
   - Check the Home screen for current weather
   - Swipe through the weather carousel for forecasts
   - Pull down to refresh weather data

5. **Track History**
   - Visit the History tab to see all past diagnoses and analyses
   - Filter by type (diagnosis, spectroscopy, timeline)
   - View detailed records and export data

---

## 🏗️ Architecture

### Technology Stack

- **Framework**: React Native 0.81.5
- **Development Platform**: Expo SDK ~54.0
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context API
- **API Client**: Axios with interceptors
- **Storage**: AsyncStorage + Expo SecureStore
- **UI Components**: Custom design system with Material Community Icons
- **Charts**: React Native Chart Kit
- **Image Processing**: Expo Image Picker & Image Manipulator
- **Location Services**: Expo Location
- **Audio**: Expo AV & Expo Speech

### Project Structure

```
AgriSense/
├── app/                    # Screen components (Expo Router)
│   ├── (tabs)/            # Tab navigation screens
│   │   ├── home.tsx      # Home dashboard
│   │   ├── diagnosis.tsx # Disease diagnosis screen
│   │   ├── spectroscopy.tsx
│   │   ├── chat.tsx      # AI chat interface
│   │   ├── history.tsx   # Activity history
│   │   └── profile.tsx   # User profile
│   ├── login.tsx         # Authentication
│   ├── register.tsx      # User registration
│   └── _layout.tsx       # Root layout
├── src/
│   ├── components/      # Reusable UI components
│   │   ├── charts/      # Chart components
│   │   └── ui/          # UI primitives
│   ├── context/         # React Context providers
│   │   └── AppContext.tsx
│   ├── services/        # API and external services
│   │   └── api.ts       # API client
│   ├── theme/          # Design system
│   │   ├── colors.ts
│   │   ├── spacing.ts
│   │   ├── typography.ts
│   │   └── elevation.ts
│   ├── utils/          # Utility functions
│   └── constants/      # App constants
├── assets/             # Images, fonts, etc.
├── app.json           # Expo configuration
├── package.json       # Dependencies
└── eas.json          # EAS Build configuration
```

### Key Design Patterns

- **Context API**: Global state management for user data, history, and app state
- **Custom Hooks**: Reusable logic for network status, theming, and translations
- **Service Layer**: Centralized API communication with retry logic and error handling
- **Component Composition**: Modular, reusable UI components
- **Type Safety**: Full TypeScript implementation

---

## 🔌 API Integration

### Backend Endpoints

The app integrates with a RESTful backend API for:

- **Authentication**: User registration, login, token management
- **Diagnosis**: Image-based disease detection
- **Chat**: AI-powered conversation endpoints
- **User Management**: Profile updates and preferences
- **History**: Diagnosis and spectroscopy record management

### API Configuration

API endpoints are configured in `src/services/api.ts`:

- **Production API**: `https://buairapp.onrender.com`
- **Chat API**: Separate service endpoint
- **Development**: Configurable local/remote backend

### Authentication

- JWT-based authentication with secure token storage
- Automatic token refresh and error handling
- Secure storage using Expo SecureStore

### Error Handling

- Comprehensive error handling with user-friendly messages
- Retry logic with exponential backoff
- Network status monitoring
- Graceful degradation for offline scenarios

---

## 🛠️ Development

### Available Scripts

```bash
# Start development server
npm start

# Start with specific platform
npm run android    # Android emulator
npm run ios        # iOS simulator
npm run web        # Web browser

# Linting
npm run lint

# Reset project (removes example code)
npm run reset-project
```

### Code Quality

- **TypeScript**: Full type safety throughout the codebase
- **ESLint**: Code linting with Expo configuration
- **Error Boundaries**: Graceful error handling
- **Loading States**: Comprehensive loading indicators
- **Empty States**: User-friendly empty state components

### Testing

- Test on physical devices using Expo Go
- Use iOS Simulator or Android Emulator for development
- Test API integration with production/development backends

---

## 📦 Building

### Building for Production

The app uses **EAS Build** (Expo Application Services) for production builds.

#### Prerequisites

1. Install EAS CLI globally:
   ```bash
   npm install -g eas-cli
   ```

2. Login to your Expo account:
   ```bash
   eas login
   ```

#### Build Commands

**Android APK (Production)**
```bash
cd AgriSense
eas build --platform android --profile production --non-interactive
```

**iOS App Store**
```bash
eas build --platform ios --profile production
```

**Android App Bundle (Play Store)**
```bash
eas build --platform android --profile production
```

### Build Configuration

Build profiles are configured in `eas.json`:
- **Production**: Optimized builds for app stores
- **Development**: Development builds with debugging enabled

### App Store Deployment

- **Package Name**: `com.buair.agrisense`
- **Version**: 1.0.0
- **Version Code**: 1

---

## 🎨 Design System

### Color Palette

The app uses a comprehensive color system defined in `src/theme/colors.ts`:
- **Primary**: Green tones for agricultural theme
- **Semantic**: Success, error, warning, info colors
- **Neutral**: Text, background, and border colors
- **Gradients**: Linear gradients for modern UI elements

### Typography

- **iOS**: SF Pro Text / Helvetica Neue
- **Android**: Roboto / Sans-serif
- **Hierarchy**: Headings, body text, captions with consistent sizing

### Spacing & Layout

- Consistent spacing scale (4px base unit)
- Responsive layouts for different screen sizes
- Safe area handling for notched devices

### Components

- **Cards**: Elevated cards with shadows and rounded corners
- **Buttons**: Primary, secondary, and icon buttons
- **Inputs**: Text inputs with validation states
- **Charts**: Custom chart components for data visualization
- **Modals**: Full-screen and bottom sheet modals

---

## 🌍 Localization

The app supports multiple languages:

- **English** (en)
- **Luganda** (lg)
- **Ateso** (at)
- **Japadhola** (jap)
- **Swahili** (sw)
- **Runyankore** (nyn)

Language preferences are stored in user profile and applied throughout the app.

---

## 🔒 Permissions

The app requires the following permissions:

- **Camera**: For capturing crop images
- **Microphone**: For voice chat functionality
- **Location**: For weather data and GPS coordinates
- **Storage**: For saving images and cache data

Permissions are requested at runtime with clear explanations.

---

## 🐛 Troubleshooting

### Common Issues

**1. Metro bundler errors**
```bash
# Clear cache and restart
npx expo start --clear
```

**2. API connection errors**
- Check network connectivity
- Verify API endpoint configuration
- Check backend server status

**3. Image picker not working**
- Ensure camera/storage permissions are granted
- Check device compatibility

**4. Location services errors**
- Enable location services in device settings
- Grant location permissions when prompted

### Debugging

- Use React Native Debugger for advanced debugging
- Check Expo DevTools for runtime information
- Review console logs for API calls and errors

---

## 📝 License

This project is proprietary software. All rights reserved.

---

## 👥 Contributing

This is a private project. For questions or issues, please contact the development team.

---

## 📞 Support

For technical support or feature requests, please contact:
- **Email**: [Your support email]
- **Documentation**: [Link to documentation]

---

## 🗺️ Roadmap

### Upcoming Features

- [ ] Offline mode for diagnosis (on-device ML)
- [ ] Advanced analytics dashboard
- [ ] Social sharing capabilities
- [ ] Push notifications for weather alerts
- [ ] Integration with agricultural databases
- [ ] Multi-crop support expansion
- [ ] Export reports in PDF format

### Known Limitations

- Weather data requires location permissions
- Some features require active internet connection
- ML model accuracy depends on image quality

---

## 🙏 Acknowledgments

- Built with [Expo](https://expo.dev)
- Powered by [React Native](https://reactnative.dev)
- UI components from [Material Community Icons](https://github.com/Templarian/MaterialDesign)
- Weather data from [Open-Meteo](https://open-meteo.com)

---

<div align="center">

**Made with ❤️ for farmers and agricultural communities**

*Empowering agriculture through technology*

</div>
