# Quick Start Guide - File Sharing App

## 🚀 Build Your APK in 3 Steps

### Step 1: Login to Expo

```bash
npx eas-cli login
```

Create a free account at https://expo.dev if you don't have one.

### Step 2: Configure EAS Build

```bash
npx eas build:configure
```

This will set up your project for EAS Build.

### Step 3: Build the APK

```bash
npx eas build --platform android --profile preview
```

This will:
- Upload your project to Expo servers
- Build the APK in the cloud
- Provide a download link when complete

⏱️ **Build time**: 5-10 minutes for first build

## 📱 Install on Your Devices

1. Download the APK from the link provided by EAS
2. Transfer to both Android devices
3. Install on both devices (enable "Install Unknown Apps" if prompted)
4. Launch the app on both devices

## 📤 How to Transfer Files

### On Receiver Device:
1. Open app
2. Grant all permissions
3. Tap **"Receive Files"**
4. Wait for "Receiver Ready" alert
5. Note the Network Name and Password
6. Keep app open

### On Sender Device:
1. Open app
2. Grant all permissions
3. Tap **"Send Files"**
4. Wait for receiver to appear in device list
5. Tap on receiver device
6. Once connected, tap **"Select File to Send"**
7. Choose any file
8. Tap "Send"
9. Wait for transfer to complete

## 📋 Commands Cheat Sheet

```bash
# Install dependencies
npm install

# Build preview APK (for testing)
npx eas build --platform android --profile preview

# Build production APK
npx eas build --platform android --profile production

# Check build status
npx eas build:list

# Generate native code (if needed)
npx expo prebuild --platform android --clean

# Development mode (for testing UI only, WiFi Direct won't work)
npm start
npm run android
```

## ⚠️ Important Notes

1. **Both devices need WiFi enabled** (not necessarily connected)
2. **Grant ALL permissions** when requested
3. **Keep devices close** (within 10 meters)
4. **Receiver must start BEFORE sender**
5. **Only works on physical devices**, not emulators

## 🐛 Common Issues

### "Permission Denied" Error
- Go to Settings > Apps > File Sharing App > Permissions
- Enable Location, Nearby Devices, and Storage

### Devices Not Discovering
- Restart WiFi on both devices
- Restart the app
- Keep devices closer together

### Connection Timeout
- Ensure receiver is in "Receive Files" mode
- Wait for "Receiver Ready" alert before starting sender
- Try creating receiver again

## 📊 What Files Can Be Sent?

- ✅ Images (JPG, PNG, etc.)
- ✅ Videos (MP4, AVI, etc.)
- ✅ Audio (MP3, WAV, etc.)
- ✅ Documents (PDF, DOCX, etc.)
- ✅ APKs
- ✅ ZIP files
- ✅ Any file type!

## 💾 Where Are Received Files Saved?

Files are saved to: `/storage/emulated/0/Download/`

You can find them in the **Downloads** folder using any file manager.

## 🔧 Testing Tips

1. **Start with small files** (< 10MB) to test
2. **Use two different Android devices** (not the same device)
3. **Android 10+** required on both devices
4. **WiFi must be turned ON** (but doesn't need internet)
5. **Close other WiFi Direct apps** before testing

## 📞 Need Help?

Check the full README.md for:
- Detailed troubleshooting
- Technical architecture
- Performance details
- Development guide

---

**Happy File Sharing! 🎉**
