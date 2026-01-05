import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import WiFiP2P, {
  initialize,
  startDiscoveringPeers,
  stopDiscoveringPeers,
  connect,
  cancelConnect,
  getConnectionInfo,
  getAvailablePeers,
  removeGroup,
} from 'react-native-wifi-p2p';
import TcpSocket from 'react-native-tcp-socket';
import { Buffer } from 'buffer';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { WiFiP2PDevice, FileMetadata, TransferProgress as TransferProgressType, ConnectionStatus } from '../types';
import FilePickerModal from './FilePickerModal';
import TransferProgress from './TransferProgress';
import { useTransferHistory, formatBytes } from '../hooks/useTransferHistory';

const TCP_PORT = 8888;
const CHUNK_SIZE = 8192; // 8KB chunks for file transfer

// Extended status type for new workflow
type SenderStatus = ConnectionStatus | 'file_selected' | 'scanning';

interface SenderProps {
  onBack: () => void;
}

export default function Sender({ onBack }: SenderProps) {
  const [status, setStatus] = useState<SenderStatus>('idle');
  const [peers, setPeers] = useState<WiFiP2PDevice[]>([]);
  const [selectedPeer, setSelectedPeer] = useState<WiFiP2PDevice | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<any[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [progress, setProgress] = useState<TransferProgressType>({
    transferred: 0,
    total: 0,
    percentage: 0,
  });
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [transferStart, setTransferStart] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const [receiverIp, setReceiverIp] = useState<string | null>(null);

  const socketRef = useRef<any>(null);
  const discoveryIntervalRef = useRef<any>(null);
  const { addSentRecord } = useTransferHistory();

  useEffect(() => {
    // Initialize WiFi P2P on mount (but don't start discovery yet)
    initializeWifiP2P();

    return () => {
      cleanup();
    };
  }, []);

  /**
   * Initialize WiFi P2P only (no peer discovery yet)
   */
  const initializeWifiP2P = async () => {
    try {
      // Initialize WiFi P2P - handle already initialized errors
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
      // Stay in idle mode - user needs to select file first
      setStatus('idle');
    } catch (error) {
      console.error('Initialization error:', error);
      Alert.alert('Error', 'Failed to initialize WiFi P2P: ' + error);
      setStatus('error');
    }
  };

  /**
   * Start discovering peers (called after file selection)
   */
  const startPeerDiscovery = async () => {
    try {
      setStatus('scanning');
      setPeers([]);

      // Start discovering peers
      try {
        await startDiscoveringPeers();
        console.log('Started discovering peers');
      } catch (discoverError: any) {
        console.warn('Could not start peer discovery:', discoverError);
      }

      // Subscribe to peer updates via polling
      discoveryIntervalRef.current = setInterval(async () => {
        try {
          const peersResult = await getAvailablePeers();
          setPeers((peersResult?.devices || []) as WiFiP2PDevice[]);
        } catch (error) {
          console.log('Error getting peers:', error);
        }
      }, 2000);

    } catch (error) {
      console.error('Discovery error:', error);
      Alert.alert('Error', 'Failed to start peer discovery: ' + error);
      setStatus('file_selected');
    }
  };

  /**
   * Stop peer discovery
   */
  const stopPeerDiscovery = async () => {
    try {
      await stopDiscoveringPeers();
      if (discoveryIntervalRef.current) {
        clearInterval(discoveryIntervalRef.current);
        discoveryIntervalRef.current = null;
      }
      setPeers([]);
    } catch (error) {
      console.log('Error stopping discovery:', error);
    }
  };

  /**
   * Disconnect / Unpair from the current connection
   */
  const handleDisconnect = async () => {
    Alert.alert(
      'Disconnect?',
      'Are you sure you want to disconnect from this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            try {
              // Close TCP socket if open
              if (socketRef.current) {
                socketRef.current.destroy();
                socketRef.current = null;
              }

              // Remove WiFi P2P group
              try {
                await removeGroup();
                console.log('WiFi P2P group removed');
              } catch (error) {
                console.log('Error removing group:', error);
              }

              // Cancel any pending connection
              try {
                await cancelConnect();
              } catch (error) {
                // Ignore if not connected
              }

              // Stop discovery
              await stopPeerDiscovery();

              // Reset all state
              setIsConnected(false);
              setSelectedPeer(null);
              setReceiverIp(null);
              setPeers([]);
              setProgress({ transferred: 0, total: 0, percentage: 0 });
              
              // Go back to file_selected state if files still selected, otherwise idle
              setStatus(selectedFiles.length > 0 ? 'file_selected' : 'idle');
              
              Alert.alert('Disconnected', 'You have been disconnected from the device.');
            } catch (error) {
              console.error('Disconnect error:', error);
              Alert.alert('Error', 'Failed to disconnect: ' + error);
            }
          },
        },
      ]
    );
  };

  /**
   * Connect to a selected peer
   */
  const connectToPeer = async (peer: WiFiP2PDevice) => {
    try {
      setStatus('connecting');
      setSelectedPeer(peer);

      console.log('Connecting to peer:', peer.deviceAddress);
      await connect(peer.deviceAddress);

      // Wait a moment for connection to stabilize
      setTimeout(async () => {
        const connectionInfo = await getConnectionInfo();
        console.log('Connection info:', connectionInfo);

        // Store receiver IP
        const serverIP =
          (typeof connectionInfo.groupOwnerAddress === 'string'
            ? connectionInfo.groupOwnerAddress
            : connectionInfo.groupOwnerAddress?.hostAddress) || '192.168.49.1';
        setReceiverIp(serverIP);
        setIsConnected(true);
        setStatus('connected');

        // Stop discovery after connecting
        await stopPeerDiscovery();

        Alert.alert(
          'Connected!',
          `Connected to ${peer.deviceName}\n\nReady to send your files.`,
          [
            { text: 'OK' },
          ]
        );
      }, 2000);
    } catch (error) {
      console.error('Connection error:', error);
      setStatus('error');
      Alert.alert('Connection Failed', 'Failed to connect to device: ' + error);
    }
  };

  /**
   * Handle files selected from categorized file picker
   */
  const handleFileSelected = (files: any[]) => {
    if (files && files.length > 0) {
      setSelectedFiles(files);
      setCurrentFileIndex(0);
      setShowFilePicker(false);
      setStatus('file_selected');
    }
  };

  /**
   * Send file with provided file data (avoids state race condition)
   */
  const sendFileWithData = async (file: any) => {
    if (!file) {
      Alert.alert('Error', 'No file selected');
      return;
    }

    if (!selectedPeer && !isConnected) {
      Alert.alert('Error', 'No peer connected. Please discover and connect to a receiver first.');
      return;
    }

    try {
      setStatus('transferring');
      setTransferStart(Date.now());

      // Get server IP from the selectedPeer or stored receiverIp
      let serverIP = receiverIp || selectedPeer?.ip || '192.168.49.1';
      
      if (!serverIP || serverIP === '192.168.49.1') {
        // Fallback to WiFi P2P connection info
        const connectionInfo = await getConnectionInfo();
        serverIP =
          (typeof connectionInfo.groupOwnerAddress === 'string'
            ? connectionInfo.groupOwnerAddress
            : connectionInfo.groupOwnerAddress?.hostAddress) || '192.168.49.1';
      }

      console.log(`Connecting to TCP server at ${serverIP}:${TCP_PORT}`);

      // Create TCP socket
      const socket = TcpSocket.createConnection(
        { host: serverIP, port: TCP_PORT },
        () => {
          console.log('Connected to TCP server');
          sendFileDataWithFile(socket, file);
        }
      );

      socketRef.current = socket;

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        Alert.alert('Connection Error', 'Failed to connect to receiver: ' + error);
        setStatus('error');
        addSentRecord(file.name, file.size, selectedPeer?.deviceName || 'Unknown', 'failed');
      });

      socket.on('close', () => {
        console.log('Socket closed');
      });
    } catch (error) {
      console.error('Send file error:', error);
      Alert.alert('Error', 'Failed to send file: ' + error);
      setStatus('error');
    }
  };

  /**
   * Open categorized file picker modal
   */
  const pickFile = () => {
    setShowFilePicker(true);
  };

  /**
   * Alternative: Direct document picker
   */
  const pickFileDirectly = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        multiple: true,
      });

      if (result.canceled) {
        return;
      }

      const files = result.assets.map((file: any) => ({
        uri: file.uri,
        name: file.name,
        size: file.size || 0,
        mimeType: file.mimeType || 'application/octet-stream',
      }));
      
      handleFileSelected(files);
    } catch (error) {
      console.error('File picker error:', error);
      Alert.alert('Error', 'Failed to pick file: ' + error);
    }
  };

  /**
   * Clear selected files and start over
   */
  const clearSelectedFile = () => {
    setSelectedFiles([]);
    setCurrentFileIndex(0);
    setStatus('idle');
  };

  /**
   * Cancel scanning and go back to file selection
   */
  const cancelScanning = async () => {
    await stopPeerDiscovery();
    setStatus('file_selected');
  };

  /**
   * Send file via TCP
   */
  const sendFile = async () => {
    if (!selectedFiles.length) {
      Alert.alert('Error', 'No files selected');
      return;
    }
    
    if (!selectedPeer || !isConnected) {
      Alert.alert('Error', 'Not connected to a peer. Please connect first.');
      return;
    }

    try {
      setStatus('transferring');
      setTransferStart(Date.now());

      // Get connection info to determine the group owner's IP
      const connectionInfo = await getConnectionInfo();
      const serverIP =
        (typeof connectionInfo.groupOwnerAddress === 'string'
          ? connectionInfo.groupOwnerAddress
          : connectionInfo.groupOwnerAddress?.hostAddress) || '192.168.49.1';

      console.log(`Connecting to TCP server at ${serverIP}:${TCP_PORT}`);

      // Create TCP socket
      const socket = TcpSocket.createConnection(
        { host: serverIP, port: TCP_PORT },
        () => {
          console.log('Connected to TCP server');
          sendFileData(socket);
        }
      );

      socketRef.current = socket;

      socket.on('error', (error) => {
        console.error('Socket error:', error);
        Alert.alert('Connection Error', 'Failed to connect to receiver: ' + error);
        setStatus('error');
        const currentFile = selectedFiles[currentFileIndex];
        if (currentFile && selectedPeer) {
          addSentRecord(currentFile.name, currentFile.size, selectedPeer.deviceName, 'failed');
        }
      });

      socket.on('close', () => {
        console.log('Socket closed');
      });
    } catch (error) {
      console.error('Send file error:', error);
      Alert.alert('Error', 'Failed to send file: ' + error);
      setStatus('error');
    }
  };

  /**
   * Send file metadata and data chunks over TCP socket
   */
  const sendFileData = async (socket: any) => {
    try {
      if (!selectedFiles.length) return;
      const currentFile = selectedFiles[currentFileIndex];
      await sendFileDataWithFile(socket, currentFile);
    } catch (error) {
      console.error('Send file data error:', error);
      Alert.alert('Error', 'Failed to send file data: ' + error);
      setStatus('error');
    }
  };

  /**
   * Send file metadata and data chunks over TCP socket with file parameter
   */
  const sendFileDataWithFile = async (socket: any, file: any) => {
    try {
      if (!file) return;

      // Prepare file metadata
      const metadata: FileMetadata = {
        name: file.name,
        size: file.size || 0,
        type: file.mimeType || 'application/octet-stream',
      };

      // Send metadata first with length prefix for proper message framing
      const metadataStr = JSON.stringify(metadata);
      const metadataLength = Buffer.byteLength(metadataStr, 'utf8');
      
      // Send metadata length as 4-byte big-endian integer, followed by metadata
      const lengthBuffer = Buffer.alloc(4);
      lengthBuffer.writeUInt32BE(metadataLength, 0);
      socket.write(lengthBuffer);
      socket.write(metadataStr);
      console.log('Sent metadata:', metadata);

      // Wait for metadata acknowledgment
      const ackTimeout = setTimeout(() => {
        console.warn('No ACK received, proceeding anyway...');
        sendFileChunks(socket, file);
      }, 2000);

      socket.once('data', async (data: any) => {
        clearTimeout(ackTimeout);
        const ack = data.toString().trim();
        if (ack === 'METADATA_ACK') {
          console.log('Metadata acknowledged, sending file data...');
          await sendFileChunks(socket, file);
        }
      });
    } catch (error) {
      console.error('Send file data error:', error);
      Alert.alert('Error', 'Failed to send file data: ' + error);
      setStatus('error');
    }
  };

  /**
   * Send file in chunks to avoid memory issues with large files
   */
  const sendFileChunks = async (socket: any, file: any) => {
    try {
      // Read file content
      const fileContent = await FileSystem.readAsStringAsync(file.uri, {
        encoding: 'base64',
      });

      // Convert base64 to buffer
      const buffer = Buffer.from(fileContent, 'base64');
      const totalSize = buffer.length;
      let sentBytes = 0;

      console.log(`Sending ${totalSize} bytes in chunks of ${CHUNK_SIZE}`);

      // Send file in chunks
      while (sentBytes < totalSize) {
        const chunk = buffer.slice(sentBytes, sentBytes + CHUNK_SIZE);

        // Write chunk to socket
        socket.write(chunk);

        sentBytes += chunk.length;

        // Update progress
        const percentage = Math.round((sentBytes / totalSize) * 100);
        setProgress({
          transferred: sentBytes,
          total: totalSize,
          percentage,
        });

        console.log(`Sent ${sentBytes} / ${totalSize} bytes (${percentage}%)`);

        // Small delay to prevent overwhelming the socket
        await new Promise((resolve) => setTimeout(resolve, 10));
      }

      // Send end marker to indicate file transfer complete
      socket.write(Buffer.from('__FILE_END__'));
      
      // Give time for receiver to process
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      // Close socket after sending
      socket.end();

      setStatus('completed');

      // Save to history
      await addSentRecord(
        file.name,
        file.size || totalSize,
        selectedPeer?.deviceName || 'Unknown',
        'success'
      );

      Alert.alert(
        'Transfer Complete!',
        `Successfully sent ${file.name}`,
        [
          {
            text: 'Send Another',
            onPress: resetSender,
          },
          {
            text: 'Done',
            onPress: cleanup,
          },
        ]
      );

      console.log('File transfer completed');
    } catch (error) {
      console.error('Send chunks error:', error);
      Alert.alert('Error', 'Failed to send file chunks: ' + error);
      setStatus('error');
    }
  };

  /**
   * Reset sender to send another file
   */
  const resetSender = () => {
    setSelectedFiles([]);
    setCurrentFileIndex(0);
    setProgress({ transferred: 0, total: 0, percentage: 0 });
    setIsConnected(false);
    setSelectedPeer(null);
    setReceiverIp(null);
    setStatus('idle');
  };

  /**
   * Clean up resources
   */
  const cleanup = async () => {
    try {
      // Close socket
      if (socketRef.current) {
        socketRef.current.destroy();
        socketRef.current = null;
      }

      // Stop discovering peers
      await stopPeerDiscovery();

      // Remove WiFi P2P group
      try {
        await removeGroup();
      } catch (error) {
        // Ignore if no group exists
      }

      // Disconnect from peer
      try {
        await cancelConnect();
      } catch (error) {
        // Ignore if not connected
      }

      // Go back to mode selection
      onBack();
    } catch (error) {
      console.error('Cleanup error:', error);
      onBack();
    }
  };

  /**
   * Render peer item
   */
  const renderPeerItem = ({ item }: { item: WiFiP2PDevice }) => (
    <TouchableOpacity
      style={[
        styles.peerItem,
        selectedPeer?.deviceAddress === item.deviceAddress && styles.selectedPeer,
      ]}
      onPress={() => connectToPeer(item)}
      disabled={status !== 'scanning'}
    >
      <View style={styles.peerIconContainer}>
        <Text style={styles.peerIcon}>📱</Text>
      </View>
      <View style={styles.peerInfo}>
        <Text style={styles.peerName}>{item.deviceName}</Text>
        <Text style={styles.peerAddress}>{item.deviceAddress}</Text>
      </View>
      <Text style={styles.peerArrow}>›</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={cleanup} style={styles.backButton}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Send Files</Text>
        <View style={styles.headerSpacer} />
      </View>

      <FilePickerModal
        visible={showFilePicker}
        onFileSelected={handleFileSelected}
        onCancel={() => setShowFilePicker(false)}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Indicator */}
        <View style={[styles.statusBadge, getStatusStyle(status)]}>
          <Text style={styles.statusDot}>●</Text>
          <Text style={styles.statusText}>
            {status === 'idle' ? 'Ready' :
             status === 'file_selected' ? 'Files Selected' : 
             status === 'scanning' ? 'Scanning...' : 
             status === 'connecting' ? 'Connecting...' :
             status === 'connected' ? 'Connected' :
             status === 'transferring' ? 'Transferring...' :
             status === 'completed' ? 'Complete' :
             'Error'}
          </Text>
        </View>

        {/* File Selection - Initial State */}
        {(status === 'idle' || status === 'error') && selectedFiles.length === 0 && (
          <View style={styles.selectSection}>
            <View style={styles.emptyStateIcon}>
              <Text style={styles.emptyIcon}>📂</Text>
            </View>
            <Text style={styles.selectTitle}>Select Files to Share</Text>
            <Text style={styles.selectSubtitle}>Choose photos, videos, documents or any file</Text>
            
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={pickFile}>
                <Text style={styles.primaryButtonIcon}>📁</Text>
                <Text style={styles.primaryButtonText}>Browse Files</Text>
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity style={styles.secondaryButton} onPress={pickFileDirectly}>
              <Text style={styles.secondaryButtonText}>Pick from Documents</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Files Selected - Ready to Search */}
        {selectedFiles.length > 0 && status === 'file_selected' && (
          <View style={styles.selectedSection}>
            <View style={styles.filesCard}>
              <View style={styles.filesHeader}>
                <Text style={styles.filesCount}>{selectedFiles.length}</Text>
                <Text style={styles.filesLabel}>file{selectedFiles.length !== 1 ? 's' : ''} selected</Text>
              </View>
              <View style={styles.filesList}>
                {selectedFiles.slice(0, 3).map((file: any, idx: number) => (
                  <Text key={idx} style={styles.fileItem} numberOfLines={1}>• {file.name}</Text>
                ))}
                {selectedFiles.length > 3 && (
                  <Text style={styles.moreFiles}>+{selectedFiles.length - 3} more files</Text>
                )}
              </View>
              <Text style={styles.totalSize}>
                Total: {formatBytes(selectedFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0))}
              </Text>
            </View>
            
            <TouchableOpacity style={styles.changeButton} onPress={clearSelectedFile}>
              <Text style={styles.changeButtonText}>Change Selection</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.searchButton} onPress={startPeerDiscovery}>
              <Text style={styles.searchButtonIcon}>📡</Text>
              <Text style={styles.searchButtonText}>Find Nearby Devices</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scanning for Devices */}
        {status === 'scanning' && (
          <View style={styles.scanSection}>
            <View style={styles.radarAnimation}>
              <ActivityIndicator size="large" color="#4361ee" />
            </View>
            <Text style={styles.scanTitle}>Searching for devices...</Text>
            <Text style={styles.scanHint}>Make sure receiver is in "Receive" mode</Text>
            
            {peers.length > 0 && (
              <View style={styles.peersSection}>
                <Text style={styles.peersHeader}>Available Devices</Text>
                <FlatList
                  data={peers}
                  renderItem={renderPeerItem}
                  keyExtractor={(item) => item.deviceAddress}
                  scrollEnabled={false}
                />
              </View>
            )}

            <TouchableOpacity style={styles.cancelButton} onPress={cancelScanning}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Connecting */}
        {status === 'connecting' && (
          <View style={styles.connectingSection}>
            <ActivityIndicator size="large" color="#4361ee" />
            <Text style={styles.connectingText}>Connecting to {selectedPeer?.deviceName}...</Text>
          </View>
        )}

        {/* Connected - Ready to Send */}
        {status === 'connected' && isConnected && (
          <View style={styles.connectedSection}>
            <View style={styles.connectedBadge}>
              <Text style={styles.connectedIcon}>✓</Text>
              <Text style={styles.connectedText}>Connected to {selectedPeer?.deviceName}</Text>
            </View>
            
            <View style={styles.transferCard}>
              <Text style={styles.transferTitle}>Ready to Send</Text>
              <Text style={styles.transferFiles}>{selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}</Text>
              <Text style={styles.transferSize}>
                {formatBytes(selectedFiles.reduce((sum: number, f: any) => sum + (f.size || 0), 0))}
              </Text>
            </View>

            <TouchableOpacity style={styles.sendButton} onPress={() => sendFile()}>
              <Text style={styles.sendButtonIcon}>📤</Text>
              <Text style={styles.sendButtonText}>Send Now</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
              <Text style={styles.disconnectText}>Disconnect</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Transfer Progress */}
        {status === 'transferring' && selectedFiles.length > 0 && (
          <TransferProgress
            data={{
              transferred: progress.transferred,
              total: progress.total,
              startTime: transferStart,
              fileName: selectedFiles[currentFileIndex]?.name || 'File',
              counterpartName: selectedPeer?.deviceName || 'Unknown',
              isReceiving: false,
            }}
          />
        )}

        {/* Completion */}
        {status === 'completed' && (
          <View style={styles.completedSection}>
            <View style={styles.successIcon}>
              <Text style={styles.successEmoji}>✅</Text>
            </View>
            <Text style={styles.successTitle}>Transfer Complete!</Text>
            <Text style={styles.successSubtitle}>
              Files sent to {selectedPeer?.deviceName}
            </Text>
            <TouchableOpacity style={styles.doneButton} onPress={resetSender}>
              <Text style={styles.doneButtonText}>Send More Files</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Initializing */}
        {status === 'initializing' && (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color="#4361ee" />
            <Text style={styles.loadingText}>Initializing...</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const getStatusStyle = (status: SenderStatus) => {
  switch (status) {
    case 'idle': return { backgroundColor: 'rgba(100,100,100,0.1)' };
    case 'file_selected': return { backgroundColor: 'rgba(67,97,238,0.1)' };
    case 'scanning': return { backgroundColor: 'rgba(255,193,7,0.1)' };
    case 'connecting': return { backgroundColor: 'rgba(156,39,176,0.1)' };
    case 'connected': return { backgroundColor: 'rgba(6,214,160,0.1)' };
    case 'transferring': return { backgroundColor: 'rgba(255,152,0,0.1)' };
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
    color: '#4361ee',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  
  // Select Section
  selectSection: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyIcon: {
    fontSize: 48,
  },
  selectTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  selectSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonRow: {
    width: '100%',
    marginBottom: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4361ee',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonIcon: {
    fontSize: 20,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryButtonText: {
    fontSize: 14,
    color: '#4361ee',
    fontWeight: '500',
  },
  
  // Selected Section
  selectedSection: {
    alignItems: 'center',
  },
  filesCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  filesHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  filesCount: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4361ee',
    marginRight: 8,
  },
  filesLabel: {
    fontSize: 16,
    color: '#666',
  },
  filesList: {
    marginBottom: 12,
  },
  fileItem: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  moreFiles: {
    fontSize: 13,
    color: '#999',
    fontStyle: 'italic',
  },
  totalSize: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
  },
  changeButton: {
    marginBottom: 20,
  },
  changeButtonText: {
    fontSize: 14,
    color: '#666',
    textDecorationLine: 'underline',
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#06d6a0',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  searchButtonIcon: {
    fontSize: 20,
  },
  searchButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  
  // Scan Section
  scanSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  radarAnimation: {
    marginBottom: 20,
  },
  scanTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  scanHint: {
    fontSize: 13,
    color: '#666',
    marginBottom: 24,
  },
  peersSection: {
    width: '100%',
    marginBottom: 20,
  },
  peersHeader: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  peerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  selectedPeer: {
    borderColor: '#4361ee',
    borderWidth: 2,
    backgroundColor: '#f0f4ff',
  },
  peerIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  peerIcon: {
    fontSize: 20,
  },
  peerInfo: {
    flex: 1,
  },
  peerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 2,
  },
  peerAddress: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
  },
  peerArrow: {
    fontSize: 20,
    color: '#ccc',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#666',
  },
  
  // Connecting Section
  connectingSection: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  connectingText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  
  // Connected Section
  connectedSection: {
    alignItems: 'center',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(6,214,160,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    marginBottom: 24,
  },
  connectedIcon: {
    fontSize: 16,
    color: '#06d6a0',
    marginRight: 8,
  },
  connectedText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06d6a0',
  },
  transferCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  transferTitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  transferFiles: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  transferSize: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4361ee',
    paddingVertical: 18,
    borderRadius: 12,
    gap: 10,
    width: '100%',
    marginBottom: 12,
  },
  sendButtonIcon: {
    fontSize: 22,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  disconnectButton: {
    paddingVertical: 12,
  },
  disconnectText: {
    fontSize: 14,
    color: '#ef4444',
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
    marginBottom: 32,
  },
  doneButton: {
    backgroundColor: '#4361ee',
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
});
