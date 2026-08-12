import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS, FONT } from '../utils/constants';

export default function LoadingOverlay({ message = '加载中...' }) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.PRIMARY} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.BG,
  },
  text: {
    marginTop: 16,
    fontSize: FONT.BODY,
    color: COLORS.TEXT_SECONDARY,
  },
});