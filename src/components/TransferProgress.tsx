import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { formatBytes } from '../hooks/useTransferHistory';

export interface TransferProgressData {
  transferred: number;
  total: number;
  startTime: number;
  fileName: string;
  counterpartName: string;
  isReceiving: boolean;
}

interface TransferProgressProps {
  data: TransferProgressData;
}

/**
 * Real-Time Transfer Progress Component
 * Shows progress bar, transferred/total bytes, and percentage
 */
export default function TransferProgress({ data }: TransferProgressProps) {
  const percentage = data.total > 0 ? Math.round((data.transferred / data.total) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.direction}>
          {data.isReceiving ? '📥' : '📤'} {data.isReceiving ? 'Receiving' : 'Sending'}
        </Text>
        <Text style={styles.counterpart}>{data.counterpartName}</Text>
      </View>

      {/* File Name */}
      <Text style={styles.fileName} numberOfLines={1}>
        {data.fileName}
      </Text>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBar, { width: `${percentage}%` }]} />
      </View>

      {/* Percentage and Size */}
      <View style={styles.statsRow}>
        <Text style={styles.percentage}>{percentage}%</Text>
        <Text style={styles.size}>
          {formatBytes(data.transferred)} / {formatBytes(data.total)}
        </Text>
      </View>

      {/* Completion Status */}
      {percentage === 100 && (
        <View style={styles.completionContainer}>
          <Text style={styles.completionText}>✓ Transfer Complete!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  direction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a2e',
    marginRight: 10,
  },
  counterpart: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    color: '#1a1a2e',
    fontWeight: '500',
    marginBottom: 16,
  },
  progressBarContainer: {
    height: 10,
    backgroundColor: '#e0e0e0',
    borderRadius: 5,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4361ee',
    borderRadius: 5,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  percentage: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4361ee',
  },
  size: {
    fontSize: 13,
    color: '#999',
  },
  completionContainer: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(6,214,160,0.1)',
    borderRadius: 10,
  },
  completionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#06d6a0',
  },
});
