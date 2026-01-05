import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as DocumentPicker from 'expo-document-picker';

export interface PickedFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

interface FilePickerModalProps {
  visible: boolean;
  onFileSelected: (files: PickedFile[]) => void;
  onCancel: () => void;
}

type CategoryTab = 'photos' | 'videos' | 'music' | 'apps';

/**
 * Modern Categorized File Picker with Multi-Selection
 * Allows users to select multiple files by category
 */
export default function FilePickerModal({
  visible,
  onFileSelected,
  onCancel,
}: FilePickerModalProps) {
  const [activeTab, setActiveTab] = useState<CategoryTab>('photos');
  const [files, setFiles] = useState<any[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions();

  useEffect(() => {
    if (visible && activeTab !== 'apps') {
      loadMediaFiles();
    }
  }, [visible, activeTab]);

  const loadMediaFiles = async () => {
    try {
      setLoading(true);

      if (!mediaPermission?.granted) {
        await requestMediaPermission();
      }

      let mediaType: MediaLibrary.MediaTypeValue = 'photo';
      let album = 'Camera';

      if (activeTab === 'photos') {
        mediaType = 'photo';
        album = 'Camera';
      } else if (activeTab === 'videos') {
        mediaType = 'video';
        album = 'Camera';
      } else if (activeTab === 'music') {
        mediaType = 'audio';
        album = 'Music';
      }

      const media = await MediaLibrary.getAssetsAsync({
        mediaType,
        first: 100,
      });

      const formattedFiles = media.assets.map((asset) => ({
        id: asset.id,
        uri: asset.uri,
        name: asset.filename,
        size: asset.mediaType === 'photo' ? 0 : asset.duration || 0, // Use duration for video/audio
        mimeType:
          activeTab === 'photos'
            ? 'image/*'
            : activeTab === 'videos'
              ? 'video/*'
              : 'audio/*',
        type: activeTab,
        modificationTime: asset.creationTime,
      }));

      setFiles(formattedFiles);
    } catch (error) {
      console.error('Error loading media:', error);
      Alert.alert('Error', 'Failed to load media files');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectFile = (file: any) => {
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(file.id)) {
      newSelected.delete(file.id);
    } else {
      newSelected.add(file.id);
    }
    setSelectedFiles(newSelected);
  };

  const handleConfirmSelection = () => {
    if (selectedFiles.size === 0) {
      Alert.alert('No Files Selected', 'Please select at least one file.');
      return;
    }

    const selectedFileObjects = files.filter(f => selectedFiles.has(f.id)).map(f => ({
      uri: f.uri,
      name: f.name,
      size: f.size || 0,
      mimeType: f.mimeType,
    }));

    onFileSelected(selectedFileObjects);
  };

  const handlePickApp = async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/vnd.android.package-archive',
      });

      if (!result.canceled) {
        const file = result.assets[0];
        onFileSelected([{
          uri: file.uri,
          name: file.name,
          size: file.size || 0,
          mimeType: 'application/vnd.android.package-archive',
        }]);
      }
    } catch (error) {
      console.error('Error picking app:', error);
      Alert.alert('Error', 'Failed to pick APK file');
    } finally {
      setLoading(false);
    }
  };

  const handlePickCustomFile = async () => {
    try {
      setLoading(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
      });

      if (!result.canceled) {
        const file = result.assets[0];
        onFileSelected([{
          uri: file.uri,
          name: file.name,
          size: file.size || 0,
          mimeType: file.mimeType || 'application/octet-stream',
        }]);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick file');
    } finally {
      setLoading(false);
    }
  };

  const renderFileItem = ({ item }: { item: any }) => {
    const isSelected = selectedFiles.has(item.id);
    
    return (
      <TouchableOpacity
        style={[
          styles.fileCard,
          isSelected && styles.fileCardSelected,
        ]}
        onPress={() => handleSelectFile(item)}
        activeOpacity={0.7}
      >
        <View style={styles.fileCardContent}>
          <View style={[styles.fileCardIcon, isSelected && styles.fileCardIconSelected]}>
            <Text style={styles.fileCardIconText}>
              {activeTab === 'photos' ? '🖼️' : activeTab === 'videos' ? '🎥' : '🎵'}
            </Text>
          </View>
          <View style={styles.fileCardInfo}>
            <Text style={styles.fileCardName} numberOfLines={2}>
              {item.name}
            </Text>
            {activeTab === 'videos' || activeTab === 'music' ? (
              <Text style={styles.fileCardMeta}>{Math.round(item.size / 60)}s</Text>
            ) : (
              <Text style={styles.fileCardMeta}>Ready to send</Text>
            )}
          </View>
          <View style={[styles.fileCardCheckbox, isSelected && styles.checkboxSelected]}>
            <Text style={styles.checkboxIcon}>{isSelected ? '✓' : ''}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const appsContent = (
    <ScrollView style={styles.appsContent} contentContainerStyle={styles.appsContentContainer}>
      <View style={styles.appsSection}>
        <Text style={styles.appsSectionTitle}>Installation & Custom Files</Text>
        <Text style={styles.appsSectionDesc}>Select APK files or any documents</Text>
        
        <TouchableOpacity style={styles.appsCard} onPress={handlePickApp}>
          <View style={styles.appsCardIcon}>
            <Text style={styles.appsCardIconText}>📦</Text>
          </View>
          <View style={styles.appsCardContent}>
            <Text style={styles.appsCardTitle}>APK Files</Text>
            <Text style={styles.appsCardDesc}>Android applications</Text>
          </View>
          <View style={styles.appsCardArrow}>
            <Text style={styles.arrowIcon}>→</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.appsCard} onPress={handlePickCustomFile}>
          <View style={styles.appsCardIcon}>
            <Text style={styles.appsCardIconText}>📄</Text>
          </View>
          <View style={styles.appsCardContent}>
            <Text style={styles.appsCardTitle}>Any File</Text>
            <Text style={styles.appsCardDesc}>Documents, archives, etc.</Text>
          </View>
          <View style={styles.appsCardArrow}>
            <Text style={styles.arrowIcon}>→</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const mediaContent = (
    <View style={styles.mediaContent}>
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#4361ee" />
          <Text style={styles.loadingText}>Loading files...</Text>
        </View>
      ) : files.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>No {activeTab} found</Text>
          <Text style={styles.emptySubtext}>Try another category</Text>
        </View>
      ) : (
        <FlatList
          data={files}
          renderItem={renderFileItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={true}
          contentContainerStyle={styles.fileListContent}
        />
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onCancel}>
            <Text style={styles.backButton}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Choose File</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          style={styles.tabsContainer}
          horizontal={true}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {(['photos', 'videos', 'music', 'apps'] as CategoryTab[]).map(
            (tab) => (
              <TouchableOpacity
                key={tab}
                style={[
                  styles.tab,
                  activeTab === tab && styles.activeTab,
                ]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={styles.tabIcon}>
                  {tab === 'photos'
                    ? '🖼️'
                    : tab === 'videos'
                      ? '🎥'
                      : tab === 'music'
                        ? '🎵'
                        : '📦'}
                </Text>
                <Text
                  style={[
                    styles.tabText,
                    activeTab === tab && styles.activeTabText,
                  ]}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            )
          )}
        </ScrollView>

        <View style={styles.contentWrapper}>
          {activeTab === 'apps' ? appsContent : mediaContent}
        </View>

        {/* Summary Bar - Sticky at bottom */}
        <View style={styles.summaryBar}>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryText}>
              {selectedFiles.size} {selectedFiles.size === 1 ? 'file' : 'files'} selected
            </Text>
            {selectedFiles.size > 0 && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirmSelection}
              >
                <Text style={styles.confirmButtonText}>Send</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 0,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1a1a2e',
    paddingTop: 50,
  },
  backButton: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
    width: 60,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
  },
  tabsContainer: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 25,
    backgroundColor: '#f0f4ff',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  activeTab: {
    backgroundColor: '#4361ee',
  },
  tabIcon: {
    fontSize: 18,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    minWidth: 50,
    textAlign: 'center',
  },
  activeTabText: {
    color: '#fff',
  },
  contentWrapper: {
    flex: 1,
  },
  mediaContent: {
    flex: 1,
  },
  fileListContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 100,
  },
  fileCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 12,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  fileCardSelected: {
    borderColor: '#4361ee',
    backgroundColor: '#f0f4ff',
  },
  fileCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  fileCardIcon: {
    width: 52,
    height: 52,
    backgroundColor: '#f0f4ff',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  fileCardIconSelected: {
    backgroundColor: '#e0e8ff',
  },
  fileCardIconText: {
    fontSize: 26,
  },
  fileCardInfo: {
    flex: 1,
  },
  fileCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  fileCardMeta: {
    fontSize: 12,
    color: '#999',
  },
  fileCardCheckbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  checkboxSelected: {
    backgroundColor: '#4361ee',
    borderColor: '#4361ee',
  },
  checkboxIcon: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  appsContent: {
    flex: 1,
  },
  appsContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 100,
  },
  appsSection: {
    marginBottom: 20,
  },
  appsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 4,
  },
  appsSectionDesc: {
    fontSize: 13,
    color: '#999',
    marginBottom: 16,
  },
  appsCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  appsCardIcon: {
    width: 56,
    height: 56,
    backgroundColor: '#f0f4ff',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  appsCardIconText: {
    fontSize: 28,
  },
  appsCardContent: {
    flex: 1,
  },
  appsCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
    marginBottom: 3,
  },
  appsCardDesc: {
    fontSize: 12,
    color: '#999',
  },
  appsCardArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  arrowIcon: {
    fontSize: 16,
    color: '#4361ee',
    fontWeight: 'bold',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  summaryBar: {
    backgroundColor: '#1a1a2e',
    paddingHorizontal: 20,
    paddingVertical: 16,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  summaryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  confirmButton: {
    backgroundColor: '#06d6a0',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 25,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
