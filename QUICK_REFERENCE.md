# 🚀 Quick Command Reference

## Essential Commands for File Sharing App

### 📦 Building

```powershell
# Login to Expo (first time only)
npx eas login

# Build APK for testing
npx eas build --platform android --profile preview

# Build for Play Store
npx eas build --platform android --profile production

# Local build (requires Android SDK)
npx eas build --platform android --profile preview --local
```

### 🔧 Development

```powershell
# Start development server
npm start

# Rebuild native project
npx expo prebuild --clean

# Check for errors
npx tsc --noEmit
```

### 📱 Testing

```powershell
# Install APK via ADB
adb install app.apk

# View device logs
adb logcat | findstr ReactNative

# List connected devices
adb devices
```

### 🆘 Troubleshooting

```powershell
# Clear everything and start fresh
rm -r -fo node_modules, android, ios
npm install
npx expo prebuild

# Clear Expo cache
npx expo start -c

# Clear Android build cache
cd android; .\gradlew clean; cd ..
```

---

## 📂 Project Files

| File | Purpose |
|------|---------|
| `App.tsx` | Main app with mode selection |
| `src/components/Receiver.tsx` | Receiver mode (TCP Server) |
| `src/components/Sender.tsx` | Sender mode (TCP Client) |
| `src/utils/permissions.ts` | Permission handling |
| `src/types/index.ts` | TypeScript types |
| `app.json` | Expo configuration |
| `eas.json` | Build configuration |
| `android/app/src/main/AndroidManifest.xml` | Android permissions |

---

## 🎯 Build Status

✅ Dependencies installed  
✅ Native project generated  
✅ Permissions configured  
✅ EAS build configured  
✅ TypeScript compiled  
✅ No errors

**Ready to build!**

---

## 📱 Testing Steps

1. **Build**: `npx eas build --platform android --profile preview`
2. **Wait**: ~10-15 minutes for build to complete
3. **Download**: Get APK from Expo build page
4. **Install**: On two Android devices
5. **Test**: 
   - Device A → Receive Files
   - Device B → Send Files → Select Device A → Pick File → Send
6. **Verify**: Check Downloads folder on Device A

---

## 🔗 Useful Links

- Build Dashboard: https://expo.dev/accounts/[your-account]/projects/file-sharing-app/builds
- Expo Docs: https://docs.expo.dev/
- WiFi P2P Docs: https://github.com/kirillzyusko/react-native-wifi-p2p

---

**Last Updated**: January 3, 2026  
**Status**: ✅ Ready to Build
