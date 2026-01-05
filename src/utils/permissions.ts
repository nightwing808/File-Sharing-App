import { Platform, PermissionsAndroid, Alert } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';

/**
 * Request all necessary Android permissions for WiFi P2P and file access
 * Handles Android 13+ (API 33+) specific permissions like NEARBY_WIFI_DEVICES
 */
export async function requestAllPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const androidVersion = Platform.Version as number;
    
    // Android 13+ (API 33+) requires different permissions
    if (androidVersion >= 33) {
      return await requestAndroid13Permissions();
    } else {
      return await requestLegacyPermissions();
    }
  } catch (error) {
    console.error('Permission request error:', error);
    Alert.alert('Permission Error', 'Failed to request permissions');
    return false;
  }
}

/**
 * Request permissions for Android 13+ (API 33+)
 */
async function requestAndroid13Permissions(): Promise<boolean> {
  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
      PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissions);

    const allGranted = Object.values(granted).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      Alert.alert(
        'Permissions Required',
        'This app needs location and WiFi permissions to share files via WiFi Direct. Please grant all permissions.'
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Android 13+ permission error:', error);
    return false;
  }
}

/**
 * Request permissions for Android 12 and below
 */
async function requestLegacyPermissions(): Promise<boolean> {
  try {
    const permissions = [
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
      PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
    ];

    const granted = await PermissionsAndroid.requestMultiple(permissions);

    const allGranted = Object.values(granted).every(
      (result) => result === PermissionsAndroid.RESULTS.GRANTED
    );

    if (!allGranted) {
      Alert.alert(
        'Permissions Required',
        'This app needs location and storage permissions to share files. Please grant all permissions.'
      );
      return false;
    }

    return true;
  } catch (error) {
    console.error('Legacy permission error:', error);
    return false;
  }
}

/**
 * Check if all required permissions are already granted
 */
export async function checkAllPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    const androidVersion = Platform.Version as number;
    
    if (androidVersion >= 33) {
      const fineLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const nearbyWifi = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES
      );
      const readMedia = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      );
      
      return fineLocation && nearbyWifi && readMedia;
    } else {
      const fineLocation = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const readStorage = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE
      );
      const writeStorage = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE
      );
      
      return fineLocation && readStorage && writeStorage;
    }
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
}
