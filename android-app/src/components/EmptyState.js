import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONT } from '../utils/constants';
import AppButton from './AppButton';

export default function EmptyState({ message = '暂无数据', actionText, onAction }) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>📭</Text>
      <Text style={styles.message}>{message}</Text>
      {actionText && onAction && (
        <AppButton title={actionText} onPress={onAction} style={styles.btn} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  icon: { fontSize: 48, marginBottom: 16 },
  message: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: FONT.BODY * 1.8 },
  btn: { marginTop: 16, minWidth: 160 },
});