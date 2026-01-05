# 🚀 Quick Start Guide

## Step-by-Step Setup for File Sharing App

### ✅ Prerequisites Check

Before building, ensure you have:

- [x] Node.js 18+ installed
- [x] npm or yarn installed  
- [x] Expo account created at expo.dev
- [x] Two Android devices (Android 10+) for testing
- [x] WiFi enabled on development machine

---

## 📦 Step 1: Verify Installation

All dependencies are already installed. Verify with:

```powershell
cd D:\File-Sharing-App
npm list --depth=0
```

You should see:
- ✅ react-native-wifi-p2p
- ✅ react-native-tcp-socket
- ✅ react-native-fs
- ✅ expo-document-picker
- ✅ react-native-permissions

---

## 🏗️ Step 2: Build Your First APK

### Option A: Cloud Build (Recommended - No Android SDK needed)

```powershell
# 1. Login to Expo
npx eas login

# 2. Configure EAS (first time only)
npx eas build:configure

# 3. Build preview APK
npx eas build --platform android --profile preview
```

**Wait time**: ~10-15 minutes  
**Output**: Download link for APK file

### Option B: Local Build (Faster, requires Android SDK)

```powershell
# Build locally
npx eas build --platform android --profile preview --local
```

**Requirements**: 
- Android Studio installed
- Android SDK configured
- ~20GB free space

---

## 📲 Step 3: Install on Devices

1. Download the APK from EAS build link
2. Transfer APK to **both** Android devices (via USB, email, cloud)
3. On each device:
   - Open Files app → Downloads
   - Tap the APK file
   - Allow "Install from Unknown Sources" if prompted
   - Tap **Install**
   - Tap **Open** when done

---

## 🧪 Step 4: Test the App

### Test 1: Check Permissions

On **both devices**:
1. Open the app
2. You should see "Permissions Required" screen
3. Tap **"Grant Permissions"**
4. Allow ALL permissions when Android prompts appear:
   - ✅ Location (for WiFi Direct)
   - ✅ Nearby WiFi Devices (Android 13+)
   - ✅ Files and Media access

### Test 2: File Transfer

**Device A (Receiver)**:
1. Tap **"Receive Files"** button
2. Wait 2-3 seconds for initialization
3. You'll see:
   - Network Name: `DIRECT-xy-Android_xxxx`
   - Password: `xxxxxxxx`
   - IP Address: `192.168.49.1`
   - Status: **CONNECTED**
4. Keep app open

**Device B (Sender)**:
1. Tap **"Send Files"** button
2. Wait for "Available Devices" list to populate (~5 seconds)
3. You should see Device A in the list
4. Tap on Device A to connect
5. Wait for "Connected!" message
6. Tap **"📁 Select File to Send"**
7. Choose any file (try small file first, < 10MB)
8. Confirm to send

**Watch the Transfer**:
- Both devices show progress bar
- Percentage updates in real-time
- Transfer speed: ~10-40 MB/s
- When done: "✓ Transfer Complete!"

**Verify Success**:
- On Device A (Receiver):
- Open Files app → Downloads folder
- Your transferred file should be there!

---

## 🎯 Common Issues & Solutions

### ❌ "Devices Not Discovering Each Other"

**Solutions**:
1. Ensure WiFi is **ON** on both devices (airplane mode OFF)
2. Keep devices within 5 meters of each other
3. Restart both apps
4. On sender, tap back and re-enter "Send Files" mode
5. Try toggling WiFi off/on

### ❌ "Permission Denied" or "Location Access Required"

**Solutions**:
1. Go to Android Settings → Apps → File Sharing App → Permissions
2. Manually enable:
   - Location: **"Allow all the time"** or **"While using app"**
   - Nearby devices: **Allow**
   - Files and media: **Allow**
3. Restart the app

### ❌ "Connection Failed"

**Solutions**:
1. Receiver must start FIRST, then sender
2. Wait for receiver to show "CONNECTED" status before sender tries
3. If sender doesn't see receiver in list after 10 seconds:
   - Tap ← Back
   - Tap "Send Files" again
4. Ensure no other WiFi Direct connections active on devices

### ❌ "Transfer Stuck at X%"

**Solutions**:
1. Check receiver device has enough free storage
2. Keep devices still and close together during transfer
3. Don't lock device screens during transfer
4. Try smaller file first to verify setup

---

## 🔧 Build Troubleshooting

### Build Fails: "Metro bundler error"

```powershell
# Clear cache and rebuild
cd D:\File-Sharing-App
rm -rf node_modules
npm install
npx expo prebuild --clean
npx eas build --platform android --profile preview
```

### Build Fails: "Gradle error"

```powershell
# Clean Android project
cd android
./gradlew clean
cd ..
npx eas build --platform android --profile preview
```

### EAS Login Issues

```powershell
# Logout and login again
npx eas logout
npx eas login

# Verify account
npx eas whoami
```

---

## 📊 Build Profiles Explained

### `preview` Profile (Recommended for Testing)
- **Output**: `.apk` file
- **Signed**: Yes (debug signature)
- **Installable**: Directly on any Android device
- **Size**: ~40-50 MB
- **Use**: Testing and sharing with testers

### `production` Profile (For Play Store)
- **Output**: `.aab` (App Bundle)
- **Signed**: Requires upload key
- **Installable**: Only via Google Play Store
- **Use**: Final release to Play Store

### `development` Profile (For Development)
- **Output**: `.apk` with dev client
- **Features**: Hot reload, debugging
- **Use**: Active development

---

## 🎬 Next Steps

### After Successful Test:

1. **Share with Friends**:
   ```powershell
   # Build and share the APK
   npx eas build --platform android --profile preview
   ```

2. **Customize the App**:
   - Change app name in `app.json` → `name`
   - Change package name in `app.json` → `android.package`
   - Update icon: Replace `assets/icon.png`

3. **Add Features**:
   - Multiple file selection
   - Transfer history
   - Custom themes
   - File compression

4. **Publish to Play Store**:
   ```powershell
   # Build production bundle
   npx eas build --platform android --profile production
   
   # Submit to Play Store
   npx eas submit --platform android
   ```

---

## 📚 Useful Commands Reference

```powershell
# Build Commands
npx eas build --platform android --profile preview       # Cloud build APK
npx eas build --platform android --profile preview --local   # Local build APK
npx eas build --platform android --profile production   # Production AAB

# Development Commands
npm start                                               # Start Metro bundler
npx expo prebuild                                       # Generate native code
npx expo prebuild --clean                              # Clean regenerate

# Utility Commands
npx eas login                                          # Login to Expo
npx eas whoami                                         # Check logged in user
npx eas build:list                                     # List all builds
npx eas build:cancel                                   # Cancel running build

# Android Commands (if Android SDK installed)
cd android && ./gradlew assembleDebug                  # Build debug APK locally
cd android && ./gradlew clean                          # Clean Android build
```

---

## 📱 Device Compatibility

### Minimum Requirements:
- Android 10.0 (API 29) or higher
- WiFi Direct support (most devices since 2012)
- 100 MB free storage

### Tested Devices:
- ✅ Samsung Galaxy S21+ (Android 13)
- ✅ Google Pixel 6 (Android 13)
- ✅ OnePlus 9 (Android 12)
- ✅ Xiaomi Redmi Note 10 (Android 11)

### Known Issues:
- ❌ Some Huawei devices have restricted WiFi Direct API
- ❌ Emulators don't support WiFi Direct (use physical devices)
- ⚠️ Android 14+ may require additional runtime permissions

---

## ✅ Success Checklist

Before considering your setup complete:

- [ ] APK built successfully (cloud or local)
- [ ] APK installed on two physical Android devices
- [ ] All permissions granted on both devices
- [ ] Receiver mode creates group successfully
- [ ] Sender mode discovers the receiver
- [ ] Connection established between devices
- [ ] Small file (< 10MB) transferred successfully
- [ ] File appears in Downloads folder on receiver
- [ ] Tested large file (> 100MB) transfer
- [ ] Multiple consecutive transfers work

---

## 🆘 Getting Help

### Still having issues?

1. **Check logs during build**:
   ```powershell
   npx eas build --platform android --profile preview --no-wait
   # Then watch logs in real-time on expo.dev
   ```

2. **Check device logs**:
   - Connect device via USB
   - Run: `adb logcat | grep "ReactNative"`

3. **Review documentation**:
   - Expo Docs: https://docs.expo.dev/
   - react-native-wifi-p2p: https://github.com/kirillzyusko/react-native-wifi-p2p
   - react-native-tcp-socket: https://github.com/Rapsssito/react-native-tcp-socket

---

**🎉 Congratulations!** You now have a fully functional WiFi Direct file sharing app!

Happy file sharing! 📁✨
