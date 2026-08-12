import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { COLORS, FONT, BUTTON } from '../utils/constants';

export default function AppButton({
  title, onPress, type = 'primary', disabled = false, loading = false, style,
}) {
  const bgColor = disabled ? COLORS.DISABLED
    : type === 'primary' ? COLORS.PRIMARY
    : type === 'danger' ? COLORS.DANGER
    : type === 'warning' ? COLORS.WARNING
    : type === 'outline' ? 'transparent'
    : COLORS.PRIMARY;

  const textColor = type === 'outline' ? COLORS.PRIMARY : COLORS.WHITE;
  const borderColor = type === 'outline' ? COLORS.PRIMARY : 'transparent';

  return (
    <TouchableOpacity
      style={[styles.button, { backgroundColor: bgColor, borderColor }, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={textColor} size="small" />
      ) : (
        <Text style={[styles.text, { color: textColor }]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: BUTTON.MIN_HEIGHT,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderWidth: 1.5,
  },
  text: {
    fontSize: FONT.BODY,
    fontWeight: '600',
  },
});