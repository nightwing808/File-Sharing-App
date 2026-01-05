import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  RefreshControl,
  Modal,
} from 'react-native';
import { TransferRecord, useTransferHistory, formatBytes, formatDate } from '../hooks/useTransferHistory';

interface HistoryScreenProps {
  onBack: () => void;
}

/**
 * Transfer History Screen
 * Shows sent and received file transfer history with 3-dot menu options
 */
export default function HistoryScreen({ onBack }: HistoryScreenProps) {
  const {
    sentHistory,
    receivedHistory,
    loading,
    deleteRecord,
    clearHistory,
    refreshHistory,
  } = useTransferHistory();

  const [activeTab, setActiveTab] = useState<'sent' | 'received'>('sent');
  const [refreshing, setRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<TransferRecord | null>(null);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshHistory();
    setRefreshing(false);
  };

  /**
   * Open 3-dot menu for a history item
   */
  const openMenu = (item: TransferRecord) => {
    setSelectedItem(item);
    setMenuVisible(true);
  };

  /**
   * Close the menu
   */
  const closeMenu = () => {
    setMenuVisible(false);
    setSelectedItem(null);
  };

  /**
   * Show file location info
   */
  const handleShowLocation = () => {
    if (!selectedItem) return;
    
    const location = selectedItem.path || 'Downloads folder';
    Alert.alert(
      'File Location',
      `${selectedItem.fileName}\n\nSaved to:\n${location}`,
      [{ text: 'OK' }]
    );
    closeMenu();
  };

  /**
   * Delete a record from history
   */
  const handleDeleteRecord = async () => {
    if (!selectedItem) return;

    Alert.alert(
      'Delete Record?',
      'This will remove this entry from your history. The file itself will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteRecord(selectedItem.id, activeTab);
            closeMenu();
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All History?',
      'This will delete all sent and received file history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            await clearHistory();
          },
        },
      ]
    );
  };

  const renderHistoryItem = ({ item, type }: { item: TransferRecord; type: 'sent' | 'received' }) => {
    return (
      <View style={styles.historyItem}>
        <View style={styles.itemLeft}>
          <Text style={styles.statusIcon}>
            {item.status === 'success'
              ? '✓'
              : item.status === 'pending'
                ? '⏳'
                : '✕'}
          </Text>
        </View>

        <View style={styles.itemContent}>
          <View style={styles.fileNameRow}>
            <Text style={styles.itemFileName} numberOfLines={1}>
              {item.fileName}
            </Text>
          </View>
          <Text style={styles.itemDetails}>
            {type === 'sent'
              ? `Sent to ${item.counterpartName}`
              : `Received from ${item.counterpartName}`}
          </Text>
          <View style={styles.itemMeta}>
            <Text style={styles.itemSize}>{formatBytes(item.fileSize)}</Text>
            <Text style={styles.itemDate}>{formatDate(item.date)}</Text>
          </View>
        </View>

        <View style={[styles.statusBadge, getStatusStyle(item.status)]}>
          <Text style={styles.statusText}>
            {item.status === 'success'
              ? 'OK'
              : item.status === 'pending'
                ? 'PENDING'
                : 'FAILED'}
          </Text>
        </View>

        {/* 3-dot menu button - only for received files with a path */}
        {type === 'received' && (
          <TouchableOpacity
            style={styles.menuButton}
            onPress={() => openMenu(item)}
          >
            <Text style={styles.menuButtonText}>⋮</Text>
          </TouchableOpacity>
        )}

        {/* For sent items, show delete on long press via touchable wrapper */}
        {type === 'sent' && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
              setSelectedItem(item);
              Alert.alert(
                'Delete Record?',
                'This will remove this entry from your history.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteRecord(item.id, 'sent');
                    },
                  },
                ]
              );
            }}
          >
            <Text style={styles.deleteButtonText}>🗑️</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const activeHistory = activeTab === 'sent' ? sentHistory : receivedHistory;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transfer History</Text>
        <TouchableOpacity onPress={handleClearAll} disabled={activeHistory.length === 0}>
          <Text style={[styles.clearButton, activeHistory.length === 0 && styles.disabledButton]}>
            🗑️
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sent' && styles.activeTab]}
          onPress={() => setActiveTab('sent')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'sent' && styles.activeTabText,
            ]}
          >
            📤 Sent ({sentHistory.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'received' && styles.activeTab]}
          onPress={() => setActiveTab('received')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'received' && styles.activeTabText,
            ]}
          >
            📥 Received ({receivedHistory.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading history...</Text>
        </View>
      ) : activeHistory.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>
            {activeTab === 'sent' ? '📤' : '📥'}
          </Text>
          <Text style={styles.emptyText}>
            {activeTab === 'sent'
              ? 'No sent files yet'
              : 'No received files yet'}
          </Text>
          <Text style={styles.emptySubtext}>
            Your transfer history will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={activeHistory}
          renderItem={({ item }) => renderHistoryItem({ item, type: activeTab })}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      {/* Summary Stats */}
      {activeHistory.length > 0 && (
        <View style={styles.statsContainer}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total Transfers</Text>
            <Text style={styles.statValue}>{activeHistory.length}</Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Total Size</Text>
            <Text style={styles.statValue}>
              {formatBytes(activeHistory.reduce((sum, r) => sum + r.fileSize, 0))}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>Success Rate</Text>
            <Text style={styles.statValue}>
              {Math.round(
                (activeHistory.filter((r) => r.status === 'success').length /
                  activeHistory.length) *
                  100
              )}
              %
            </Text>
          </View>
        </View>
      )}

      {/* Help Text */}
      <Text style={styles.helpText}>
        {activeTab === 'received' 
          ? '💡 Tap ⋮ menu to open or delete files'
          : '💡 Tap 🗑️ to delete a record'}
      </Text>

      {/* 3-Dot Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={closeMenu}
        >
          <View style={styles.menuModal}>
            <Text style={styles.menuTitle}>
              {selectedItem?.fileName}
            </Text>
            
            {selectedItem?.path && (
              <TouchableOpacity
                style={styles.menuOption}
                onPress={handleShowLocation}
              >
                <Text style={styles.menuOptionIcon}>📍</Text>
                <Text style={styles.menuOptionText}>Show Location</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity
              style={styles.menuOption}
              onPress={handleDeleteRecord}
            >
              <Text style={styles.menuOptionIcon}>🗑️</Text>
              <Text style={[styles.menuOptionText, styles.menuOptionDestructive]}>
                Delete from History
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.menuOption, styles.menuOptionCancel]}
              onPress={closeMenu}
            >
              <Text style={styles.menuOptionCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/**
 * Get style for status badge
 */
function getStatusStyle(status: string) {
  switch (status) {
    case 'success':
      return { backgroundColor: 'rgba(6,214,160,0.15)' };
    case 'pending':
      return { backgroundColor: 'rgba(255,193,7,0.15)' };
    case 'failed':
      return { backgroundColor: 'rgba(244,67,54,0.15)' };
    default:
      return { backgroundColor: 'rgba(100,100,100,0.1)' };
  }
}

function getStatusTextColor(status: string) {
  switch (status) {
    case 'success':
      return { color: '#06d6a0' };
    case 'pending':
      return { color: '#ffc107' };
    case 'failed':
      return { color: '#ef4444' };
    default:
      return { color: '#666' };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1a1a2e',
    paddingTop: 50,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  backButton: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  clearButton: {
    fontSize: 20,
    opacity: 0.9,
  },
  disabledButton: {
    opacity: 0.3,
  },
  
  // Tabs
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  activeTab: {
    borderBottomColor: '#4361ee',
  },
  tabText: {
    fontSize: 14,
    color: '#999',
    fontWeight: '600',
  },
  activeTabText: {
    color: '#4361ee',
  },
  
  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
  },
  
  // List
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    padding: 16,
    marginBottom: 12,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  itemLeft: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f0f4ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusIcon: {
    fontSize: 20,
  },
  itemContent: {
    flex: 1,
  },
  fileNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  itemFileName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a2e',
    flexShrink: 1,
  },
  fileMissingLabel: {
    fontSize: 11,
    color: '#ef4444',
    fontWeight: '600',
    marginLeft: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  itemDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  itemMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  itemSize: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  itemDate: {
    fontSize: 11,
    color: '#999',
  },
  statusBadge: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginLeft: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#06d6a0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  menuButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  menuButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#666',
    marginTop: -4,
  },
  deleteButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239,68,68,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },
  deleteButtonText: {
    fontSize: 16,
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 20,
    backgroundColor: '#fff',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a2e',
  },
  helpText: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '85%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a2e',
    marginBottom: 24,
    textAlign: 'center',
  },
  menuOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  menuOptionIcon: {
    fontSize: 22,
    marginRight: 16,
    width: 32,
    textAlign: 'center',
  },
  menuOptionText: {
    fontSize: 16,
    color: '#1a1a2e',
    fontWeight: '500',
  },
  menuOptionDestructive: {
    color: '#ef4444',
  },
  menuOptionCancel: {
    justifyContent: 'center',
    borderBottomWidth: 0,
    marginTop: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    paddingVertical: 14,
  },
  menuOptionCancelText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    fontWeight: '600',
  },
});
