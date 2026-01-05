import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import WiFiP2P, {
  initialize,
  createGroup,
  removeGroup,
  getGroupInfo,
} from 'react-native-wifi-p2p';
import TcpSocket from 'react-native-tcp-socket';
import RNFS from 'react-native-fs';
import { Buffer } from 'buffer';
import { WiFiP2PGroup, FileMetadata, TransferProgress, ConnectionStatus } from '../types';
import { useTransferHistory, formatBytes } from '../hooks/useTransferHistory';

const TCP_PORT = 8888;

interface ReceiverProps {
  onBack: () => void;
}

export default function Receiver({ onBack }: ReceiverProps) {
  const [status, setStatus] = useState<ConnectionStatus>('idle');
  const [groupInfo, setGroupInfo] = useState<WiFiP2PGroup | null>(null);
  const [progress, setProgress] = useState<TransferProgress>({
    transferred: 0,
    total: 0,
    percentage: 0,
  });
  const [receivedFile, setReceivedFile] = useState<string | null>(null);
  const [senderDeviceName, setSenderDeviceName] = useState<string>('Sender Device');

  const serverRef = useRef<any>(null);
  const fileDataRef = useRef<Buffer[]>([]);
  const fileMetadataRef = useRef<FileMetadata | null>(null);
  const { addReceivedRecord } = useTransferHistory();

  useEffect(() => {
    initializeReceiver();

    return () => {
      cleanup();
    };
  }, []);

  /**
   * Initialize WiFi P2P and create a group (this device becomes the group owner)
   * Wrapped in useEffect to ensure it only runs once on mount
   * Catches "already initialized" errors silently
   */
  const initializeReceiver = async () => {
    try {
      // Clear any previous file data
      fileDataRef.current = [];
      fileMetadataRef.current = null;
      
      setStatus('initializing');
      
      // Initialize WiFi P2P - wrap in try-catch to handle already initialized errors
      try {
        await initialize();
        console.log('WiFi P2P initialized');
      } catch (initError: any) {
        if (initError?.message?.includes('already initialized') || 
            initError?.message?.includes('initialized once')) {
          console.log('WiFi P2P already initialized, continuing...');
        } else {
          throw initError;
        }
      }

      // Remove any existing group first
      try {
        await removeGroup();
      } catch (error) {
        // Ignore if no group exists
        console.log('No existing group to remove');
      }

      // Create a new group (this device becomes the receiver/server)
      await createGroup();
      console.log('WiFi P2P group created');

      // Wait a moment for group to stabilize
      setTimeout(async () => {
        // Get group information
        const info = await getGroupInfo();
        setGroupInfo(info as any);
        console.log('Group Info:', info);

        // Start TCP server
        startTCPServer();
        setStatus('connected');
        Alert.alert(
          'Receiver Ready',
          `Network: ${info.networkName}\nPassword: ${info.passphrase}\n\nWaiting for sender to connect...`
        );
      }, 2000);
    } catch (error) {
      console.error('Receiver initialization error:', error);
      setStatus('error');
      Alert.alert('Error', 'Failed to initialize receiver: ' + error);
    }
  };

  /**
   * Start TCP server to listen for incoming file transfers
   */
  const startTCPServer = () => {
    try {
      const server = TcpSocket.createServer((socket) => {
        console.log('Client connected to server');
        setStatus('transferring');

        let receivedMetadata = false;
        let bytesReceived = 0;
        let dataBuffer = Buffer.alloc(0); // Buffer for incoming data
        let expectedMetadataLength = -1;

        // Handle incoming data chunks
        socket.on('data', (data) => {
          try {
            dataBuffer = Buffer.concat([dataBuffer, Buffer.from(data)]);

            if (!receivedMetadata) {
              // First, we need to receive the metadata length (4 bytes)
              if (expectedMetadataLength === -1 && dataBuffer.length >= 4) {
                expectedMetadataLength = dataBuffer.readUInt32BE(0);
                console.log('Expected metadata length:', expectedMetadataLength);
                dataBuffer = dataBuffer.slice(4); // Remove length prefix
              }

              // Check if we have the complete metadata
              if (expectedMetadataLength !== -1 && dataBuffer.length >= expectedMetadataLength) {
                const metadataStr = dataBuffer.slice(0, expectedMetadataLength).toString('utf8');
                dataBuffer = dataBuffer.slice(expectedMetadataLength); // Keep remaining data

                try {
                  const metadata: FileMetadata = JSON.parse(metadataStr);
                  fileMetadataRef.current = metadata;
                  receivedMetadata = true;
                  
                  console.log('Received metadata:', metadata);
                  setProgress({
                    transferred: 0,
                    total: metadata.size,
                    percentage: 0,
                  });

                  // Send acknowledgment
                  socket.write('METADATA_ACK');
                } catch (parseError) {
                  console.error('Failed to parse metadata:', parseError);
                  Alert.alert('Error', 'Invalid metadata format: ' + parseError);
                  socket.destroy();
                }
              }
            } else {
              // Subsequent data is file content
              // Check for end marker first
              const endMarker = Buffer.from('__FILE_END__');
              const endMarkerIndex = dataBuffer.indexOf(endMarker);
              
              if (endMarkerIndex !== -1) {
                // End marker found - extract final data before marker
                const finalData = dataBuffer.slice(0, endMarkerIndex);
                if (finalData.length > 0) {
                  fileDataRef.current.push(Buffer.from(finalData));
                  bytesReceived += finalData.length;
                }
                
                // Update final progress
                setProgress({
                  transferred: bytesReceived,
                  total: fileMetadataRef.current!.size,
                  percentage: 100,
                });
                
                console.log('End marker received, saving file...');
                dataBuffer = Buffer.alloc(0);
                saveReceivedFile();
              } else if (dataBuffer.length > 0) {
                // No end marker yet, accumulate data
                fileDataRef.current.push(Buffer.from(dataBuffer));
                bytesReceived += dataBuffer.length;
                dataBuffer = Buffer.alloc(0); // Clear buffer

                // Update progress
                const percentage = Math.round(
                  (bytesReceived / fileMetadataRef.current!.size) * 100
                );
                setProgress({
                  transferred: bytesReceived,
                  total: fileMetadataRef.current!.size,
                  percentage: Math.min(percentage, 99), // Cap at 99 until complete
                });

                console.log(`Received ${bytesReceived} / ${fileMetadataRef.current!.size} bytes`);
              }
            }
          } catch (error) {
            console.error('Error processing data:', error);
            Alert.alert('Error', 'Failed to process received data: ' + error);
          }
        });

        socket.on('error', async (error) => {
          console.error('Socket error:', error);
          Alert.alert('Connection Error', 'Lost connection to sender');
          setStatus('error');

          // Save failure to history if we have metadata
          if (fileMetadataRef.current) {
            await addReceivedRecord(
              fileMetadataRef.current.name,
              fileMetadataRef.current.size,
              senderDeviceName,
              '',
              'failed'
            );
          }
        });

        socket.on('close', () => {
          console.log('Client disconnected');
        });
      });

      server.listen({ port: TCP_PORT, host: '0.0.0.0' });
      serverRef.current = server;

      server.on('error', (error) => {
        console.error('Server error:', error);
        Alert.alert('Server Error', 'Failed to start TCP server');
        setStatus('error');
      });

      console.log(`TCP Server listening on port ${TCP_PORT}`);
    } catch (error) {
      console.error('Failed to start TCP server:', error);
      Alert.alert('Error', 'Failed to start TCP server');
      setStatus('error');
    }
  };

  /**
   * Save the received file to the Downloads folder
   */
  const saveReceivedFile = async () => {
    try {
      if (!fileMetadataRef.current || fileDataRef.current.length === 0) {
        throw new Error('No file data to save');
      }

      // Combine all data chunks into a single buffer
      const completeFile = Buffer.concat(fileDataRef.current);

      // Get a reliable download path
      let downloadPath: string;
      
      try {
        // Try to use Downloads directory (most reliable)
        const downloadDir = RNFS.DownloadDirectoryPath;
        console.log('Download directory:', downloadDir);
        
        // Ensure directory exists
        const dirExists = await RNFS.exists(downloadDir);
        if (!dirExists) {
          console.warn('Download directory does not exist, will attempt creation');
        }
        
        downloadPath = `${downloadDir}/${fileMetadataRef.current.name}`;
      } catch (pathError) {
        // Fallback to documents directory if Downloads fails
        console.warn('Download directory failed, falling back to documents:', pathError);
        downloadPath = `${RNFS.DocumentDirectoryPath}/${fileMetadataRef.current.name}`;
      }
      
      // Write file as base64 (RNFS requires this format)
      await RNFS.writeFile(downloadPath, completeFile.toString('base64'), 'base64');

      // Verify file was actually written
      const fileExists = await RNFS.exists(downloadPath);
      if (!fileExists) {
        throw new Error(`File was not written successfully to ${downloadPath}`);
      }

      console.log('File saved to:', downloadPath);
      setReceivedFile(downloadPath);
      setStatus('completed');

      // Save to history with verified path
      await addReceivedRecord(
        fileMetadataRef.current.name,
        fileMetadataRef.current.size,
        senderDeviceName,
        downloadPath,
        'success'
      );

      Alert.alert(
        'Transfer Complete!',
        `File saved to:\n${downloadPath}\n\nSize: ${formatBytes(fileMetadataRef.current.size)}`,
        [
          {
            text: 'Receive Another',
            onPress: resetReceiver,
          },
          {
            text: 'Done',
            onPress: cleanup,
          },
        ]
      );
    } catch (error) {
      console.error('Error saving file:', error);
      Alert.alert('Error', 'Failed to save file: ' + error);
      setStatus('error');

      // Save failure to history
      if (fileMetadataRef.current) {
        await addReceivedRecord(
          fileMetadataRef.current.name,
          fileMetadataRef.current.size,
          senderDeviceName,
          '',
          'failed'
        );
      }
    }
  };

  /**
   * Reset receiver to accept another file
   */
  const resetReceiver = () => {
    fileDataRef.current = [];
    fileMetadataRef.current = null;
    setProgress({ transferred: 0, total: 0, percentage: 0 });
    setReceivedFile(null);
    setStatus('connected');
  };

  /**
   * Clean up resources
   */
  const cleanup = async () => {
    try {
      // Close TCP server
      if (serverRef.current) {
        serverRef.current.close();
        serverRef.current = null;
      }

      // Remove WiFi P2P group
      await removeGroup();
      
      // Go back to mode selection
      onBack();
    } catch (error) {
      console.error('Cleanup error:', error);
      onBack();
    }
  };

  /**
   * Format bytes to human-readable format
   */
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={cleanup} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Receive Files</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Badge */}
        <View style={[styles.statusBadge, getStatusStyle(status)]}>
          <Text style={styles.statusDot}>●</Text>
          <Text style={styles.statusText}>
            {status === 'idle' ? 'Ready' :
             status === 'initializing' ? 'Starting...' :
             status === 'connected' ? 'Waiting for files...' :
             status === 'transferring' ? 'Receiving...' :
             status === 'completed' ? 'Complete' :
             'Error'}
          </Text>
        </View>

        {/* Waiting State */}
        {status === 'connected' && !fileMetadataRef.current && (
          <View style={styles.waitingSection}>
            <View style={styles.radarContainer}>
              <View style={styles.radarOuter}>
                <View style={styles.radarMiddle}>
                  <View style={styles.radarInner}>
                    <Text style={styles.radarIcon}>📥</Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.waitingTitle}>Ready to Receive</Text>
            <Text style={styles.waitingHint}>Waiting for sender to connect...</Text>
            
            {/* Connection Details */}
            {groupInfo && (
              <View style={styles.connectionCard}>
                <Text style={styles.connectionTitle}>Connection Info</Text>
                <View style={styles.connectionRow}>
                  <Text style={styles.connectionLabel}>Network</Text>
                  <Text style={styles.connectionValue}>{groupInfo.networkName}</Text>
                </View>
                <View style={styles.connectionRow}>
                  <Text style={styles.connectionLabel}>Password</Text>
                  <Text style={styles.connectionValue}>{groupInfo.passphrase}</Text>
                </View>
                <View style={styles.connectionRow}>
                  <Text style={styles.connectionLabel}>IP Address</Text>
                  <Text style={styles.connectionValue}>{groupInfo.ownerAddress || '192.168.49.1'}</Text>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Transfer Progress */}
        {status === 'transferring' && fileMetadataRef.current && (
          <View style={styles.transferSection}>
            <View style={styles.transferHeader}>
              <Text style={styles.transferIcon}>📥</Text>
              <Text style={styles.transferLabel}>Receiving from {senderDeviceName}</Text>
            </View>
            
            <View style={styles.fileCard}>
              <Text style={styles.fileName} numberOfLines={1}>{fileMetadataRef.current.name}</Text>
              <Text style={styles.fileSize}>{formatBytes(fileMetadataRef.current.size)}</Text>
            </View>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBar, { width: `${progress.percentage}%` }]} />
              </View>
              <View style={styles.progressStats}>
                <Text style={styles.progressPercent}>{progress.percentage}%</Text>
                <Text style={styles.progressBytes}>
                  {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Completion */}
        {status === 'completed' && receivedFile && (
          <View style={styles.completedSection}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={styles.successTitle}>File Received!</Text>
            <Text style={styles.successSubtitle}>Saved to Downloads folder</Text>
            
            <View style={styles.filePathCard}>
              <Text style={styles.filePathLabel}>Location:</Text>
              <Text style={styles.filePath} numberOfLines={2}>{receivedFile}</Text>
            </View>
            
            <TouchableOpacity style={styles.doneButton} onPress={resetReceiver}>
              <Text style={styles.doneButtonText}>Receive Another</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Initializing */}
        {status === 'initializing' && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#06d6a0" />
            <Text style={styles.loadingText}>Setting up receiver...</Text>
          </View>
        )}

        {/* Error */}
        {status === 'error' && (
          <View style={styles.errorSection}>
            <Text style={styles.errorIcon}>⚠️</Text>
            <Text style={styles.errorTitle}>Something went wrong</Text>
            <TouchableOpacity style={styles.retryButton} onPress={initializeReceiver}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStatusStyle = (status: ConnectionStatus) => {
  switch (status) {
    case 'idle': return { backgroundColor: 'rgba(100,100,100,0.1)' };
    case 'initializing': return { backgroundColor: 'rgba(255,193,7,0.1)' };
    case 'connected': return { backgroundColor: 'rgba(6,214,160,0.1)' };
    case 'transferring': return { backgroundColor: 'rgba(67,97,238,0.1)' };
    case 'completed': return { backgroundColor: 'rgba(76,175,80,0.1)' };
    case 'error': return { backgroundColor: 'rgba(244,67,54,0.1)' };
    default: return { backgroundColor: 'rgba(100,100,100,0.1)' };
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1a1a2e',
    paddingTop: 50,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  
  content: {
    flex: 1,
    padding: 20,
  },
  
  // Status Badge
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
  },
  statusDot: {
    fontSize: 8,
    marginRight: 6,
    color: '#06d6a0',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  
  // Waiting Section
  waitingSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  radarContainer: {
    marginBottom: 24,
  },
  radarOuter: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(6,214,160,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarMiddle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(6,214,160,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#06d6a0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radarIcon: {
    fontSize: 36,
  },
  waitingTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  waitingHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 32,
  },
  
  // Connection Card
  connectionCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  connectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  connectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  connectionLabel: {
    fontSize: 14,
    color: '#666',
  },
  connectionValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    fontFamily: 'monospace',
  },
  
  // Transfer Section
  transferSection: {
    alignItems: 'center',
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  transferIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  transferLabel: {
    fontSize: 16,
    color: '#666',
  },
  fileCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  fileName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  fileSize: {
    fontSize: 13,
    color: '#999',
  },
  progressContainer: {
    width: '100%',
  },
  progressBarBg: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4361ee',
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#4361ee',
  },
  progressBytes: {
    fontSize: 13,
    color: '#999',
  },
  
  // Completed Section
  completedSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    marginBottom: 20,
  },
  successEmoji: {
    fontSize: 64,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  filePathCard: {
    width: '100%',
    backgroundColor: '#f0f4ff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  filePathLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  filePath: {
    fontSize: 12,
    color: '#1a1a2e',
    fontFamily: 'monospace',
  },
  doneButton: {
    backgroundColor: '#06d6a0',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Loading Section
  loadingSection: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  
  // Error Section
  errorSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  retryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});

/**
 * Get color for status text
 */
function getStatusColor(status: ConnectionStatus) {
  switch (status) {
    case 'connected':
      return { color: '#4CAF50' };
    case 'transferring':
      return { color: '#2196F3' };
    case 'completed':
      return { color: '#4CAF50' };
    case 'error':
      return { color: '#F44336' };
    default:
      return { color: '#666' };
  }
}
