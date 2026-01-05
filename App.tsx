import React, { useState, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  BackHandler,
  Animated,
  Dimensions,
} from 'react-native';
import { requestAllPermissions, checkAllPermissions } from './src/utils/permissions';
import Receiver from './src/components/Receiver';
import Sender from './src/components/Sender';
import HistoryScreen from './src/components/HistoryScreen';
import { AppMode } from './src/types';

const { width } = Dimensions.get('window');

export default function App() {
  const [mode, setMode] = useState<AppMode>('selection');
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeApp();
    startAnimations();
  }, []);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for main buttons
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.02,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (mode === 'selection') {
        return false;
      }
      setMode('selection');
      return true;
    });

    return () => backHandler.remove();
  }, [mode]);

  const initializeApp = async () => {
    const alreadyGranted = await checkAllPermissions();

    if (alreadyGranted) {
      setPermissionsGranted(true);
      return;
    }

    const granted = await requestAllPermissions();
    setPermissionsGranted(granted);

    if (!granted) {
      Alert.alert(
        'Permissions Required',
        'This app needs permissions to function properly.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Try Again', onPress: initializeApp },
        ]
      );
    }
  };

  const handleBackToSelection = () => {
    setMode('selection');
  };

  // Permission Screen
  if (!permissionsGranted) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.gradientBg}>
          <View style={styles.permissionCard}>
            <View style={styles.permissionIconContainer}>
              <Text style={styles.permissionIcon}>🔐</Text>
            </View>
            <Text style={styles.permissionTitle}>Permissions Needed</Text>
            <Text style={styles.permissionSubtitle}>
              To share files, we need access to:
            </Text>
            
            <View style={styles.permissionList}>
              <View style={styles.permissionRow}>
                <Text style={styles.permissionDot}>📍</Text>
                <Text style={styles.permissionText}>Location for WiFi Direct</Text>
              </View>
              <View style={styles.permissionRow}>
                <Text style={styles.permissionDot}>📡</Text>
                <Text style={styles.permissionText}>Nearby Devices Discovery</Text>
              </View>
              <View style={styles.permissionRow}>
                <Text style={styles.permissionDot}>📁</Text>
                <Text style={styles.permissionText}>Storage Access</Text>
              </View>
            </View>
            
            <TouchableOpacity
              style={styles.permissionButton}
              onPress={initializeApp}
              activeOpacity={0.8}
            >
              <Text style={styles.permissionButtonText}>Grant Access</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (mode === 'history') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <HistoryScreen onBack={handleBackToSelection} />
      </SafeAreaView>
    );
  }

  if (mode === 'receiver') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Receiver onBack={handleBackToSelection} />
      </SafeAreaView>
    );
  }

  if (mode === 'sender') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <Sender onBack={handleBackToSelection} />
      </SafeAreaView>
    );
  }

  // Main Home Screen
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.gradientBg}>
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <Text style={styles.logoText}>Swift</Text>
          <Text style={styles.logoSubtext}>Share</Text>
        </Animated.View>

        {/* Main Action Buttons */}
        <Animated.View 
          style={[
            styles.mainActions,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Send Button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setMode('sender')}
              activeOpacity={0.9}
            >
              <View style={[styles.actionIconBg, styles.sendBg]}>
                <Text style={styles.actionIcon}>📤</Text>
              </View>
              <Text style={styles.actionLabel}>Send</Text>
              <Text style={styles.actionHint}>Share files instantly</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Receive Button */}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setMode('receiver')}
              activeOpacity={0.9}
            >
              <View style={[styles.actionIconBg, styles.receiveBg]}>
                <Text style={styles.actionIcon}>📥</Text>
              </View>
              <Text style={styles.actionLabel}>Receive</Text>
              <Text style={styles.actionHint}>Get files from others</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Bottom Card */}
        <Animated.View 
          style={[
            styles.bottomCard,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* History Button */}
          <TouchableOpacity
            style={styles.historyButton}
            onPress={() => setMode('history')}
            activeOpacity={0.7}
          >
            <View style={styles.historyIconContainer}>
              <Text style={styles.historyIcon}>📋</Text>
            </View>
            <View style={styles.historyContent}>
              <Text style={styles.historyTitle}>Transfer History</Text>
              <Text style={styles.historySubtitle}>View all sent and received files</Text>
            </View>
            <Text style={styles.historyArrow}>›</Text>
          </TouchableOpacity>

          {/* Info Section */}
          <View style={styles.infoSection}>
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>⚡</Text>
              <Text style={styles.infoText}>Fast Transfer</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>🔒</Text>
              <Text style={styles.infoText}>Secure</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoItem}>
              <Text style={styles.infoIcon}>📶</Text>
              <Text style={styles.infoText}>No Internet</Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  gradientBg: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 60,
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 2,
  },
  logoSubtext: {
    fontSize: 24,
    fontWeight: '300',
    color: '#00d4ff',
    letterSpacing: 8,
    marginTop: -5,
  },

  // Main Actions
  mainActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  actionButton: {
    width: (width - 60) / 2,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  sendBg: {
    backgroundColor: '#4361ee',
  },
  receiveBg: {
    backgroundColor: '#06d6a0',
  },
  actionIcon: {
    fontSize: 36,
  },
  actionLabel: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
  },
  actionHint: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },

  // Bottom Card
  bottomCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  
  // History Button
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  historyIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#fff3e0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  historyIcon: {
    fontSize: 24,
  },
  historyContent: {
    flex: 1,
    marginLeft: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  historySubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  historyArrow: {
    fontSize: 24,
    color: '#999',
    fontWeight: '300',
  },

  // Info Section
  infoSection: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  infoItem: {
    alignItems: 'center',
    flex: 1,
  },
  infoIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  infoDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#e0e0e0',
  },

  // Permission Screen
  permissionCard: {
    margin: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  permissionIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  permissionIcon: {
    fontSize: 40,
  },
  permissionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  permissionSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionList: {
    alignSelf: 'stretch',
    marginBottom: 24,
  },
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  permissionDot: {
    fontSize: 20,
    marginRight: 12,
  },
  permissionText: {
    fontSize: 14,
    color: '#333',
  },
  permissionButton: {
    backgroundColor: '#4361ee',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  permissionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

