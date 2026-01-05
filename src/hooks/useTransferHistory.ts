import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TransferRecord {
  id: string;
  fileName: string;
  fileSize: number;
  counterpartName: string; // receiverName or senderName
  date: string;
  status: 'success' | 'failed' | 'pending';
  path?: string; // for received files only
}

interface TransferHistory {
  sentHistory: TransferRecord[];
  receivedHistory: TransferRecord[];
}

const SENT_HISTORY_KEY = '@filesharing_sent_history';
const RECEIVED_HISTORY_KEY = '@filesharing_received_history';

/**
 * Custom hook for managing transfer history
 */
export const useTransferHistory = () => {
  const [sentHistory, setSentHistory] = useState<TransferRecord[]>([]);
  const [receivedHistory, setReceivedHistory] = useState<TransferRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Load history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const [sent, received] = await Promise.all([
        AsyncStorage.getItem(SENT_HISTORY_KEY),
        AsyncStorage.getItem(RECEIVED_HISTORY_KEY),
      ]);

      setSentHistory(sent ? JSON.parse(sent) : []);
      setReceivedHistory(received ? JSON.parse(received) : []);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add a sent file record
   */
  const addSentRecord = async (
    fileName: string,
    fileSize: number,
    receiverName: string,
    status: 'success' | 'failed' = 'success'
  ) => {
    try {
      const record: TransferRecord = {
        id: `sent_${Date.now()}`,
        fileName,
        fileSize,
        counterpartName: receiverName,
        date: new Date().toISOString(),
        status,
      };

      const updated = [record, ...sentHistory];
      setSentHistory(updated);
      await AsyncStorage.setItem(SENT_HISTORY_KEY, JSON.stringify(updated));

      return record;
    } catch (error) {
      console.error('Error adding sent record:', error);
    }
  };

  /**
   * Add a received file record
   */
  const addReceivedRecord = async (
    fileName: string,
    fileSize: number,
    senderName: string,
    filePath: string,
    status: 'success' | 'failed' = 'success'
  ) => {
    try {
      const record: TransferRecord = {
        id: `received_${Date.now()}`,
        fileName,
        fileSize,
        counterpartName: senderName,
        date: new Date().toISOString(),
        status,
        path: filePath,
      };

      const updated = [record, ...receivedHistory];
      setReceivedHistory(updated);
      await AsyncStorage.setItem(RECEIVED_HISTORY_KEY, JSON.stringify(updated));

      return record;
    } catch (error) {
      console.error('Error adding received record:', error);
    }
  };

  /**
   * Clear all history
   */
  const clearHistory = async () => {
    try {
      await Promise.all([
        AsyncStorage.removeItem(SENT_HISTORY_KEY),
        AsyncStorage.removeItem(RECEIVED_HISTORY_KEY),
      ]);
      setSentHistory([]);
      setReceivedHistory([]);
    } catch (error) {
      console.error('Error clearing history:', error);
    }
  };

  /**
   * Delete a specific record
   */
  const deleteRecord = async (id: string, type: 'sent' | 'received') => {
    try {
      if (type === 'sent') {
        const updated = sentHistory.filter((r) => r.id !== id);
        setSentHistory(updated);
        await AsyncStorage.setItem(SENT_HISTORY_KEY, JSON.stringify(updated));
      } else {
        const updated = receivedHistory.filter((r) => r.id !== id);
        setReceivedHistory(updated);
        await AsyncStorage.setItem(RECEIVED_HISTORY_KEY, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error deleting record:', error);
    }
  };

  return {
    sentHistory,
    receivedHistory,
    loading,
    addSentRecord,
    addReceivedRecord,
    clearHistory,
    deleteRecord,
    refreshHistory: loadHistory,
  };
};

/**
 * Format file size for display
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

/**
 * Format date for display
 */
export const formatDate = (isoDate: string): string => {
  const date = new Date(isoDate);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
};

/**
 * Calculate transfer speed (MB/s)
 */
export const calculateSpeed = (bytes: number, durationMs: number): number => {
  if (durationMs === 0) return 0;
  const seconds = durationMs / 1000;
  const megabytes = bytes / (1024 * 1024);
  return megabytes / seconds;
};
