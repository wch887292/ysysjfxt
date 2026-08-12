import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { COLORS, FONT, BUTTON } from '../../utils/constants';

export default function AgentDashboardScreen({ navigation }) {
  const { user, logout } = useAuth();
  const [shareCode, setShareCode] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await authApi.getMyShareCode();
        if (res.success) setShareCode(res.data.shareCode || '');
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const handleLogout = () => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出', style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'people', label: '名下客户', screen: 'AgentClients', color: '#4CAF50' },
    { icon: 'bar-chart', label: '业绩统计', screen: '', color: '#2196F3' },
    { icon: 'share', label: '分享码', screen: '', color: '#FF9800', value: shareCode, copyable: true },
  ];

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 代理信息头 */}
        <View style={styles.header}>
          <Ionicons name="person-circle" size={64} color={COLORS.PRIMARY} />
          <Text style={styles.name}>{user?.nickName || '代理商'}</Text>
          <Text style={styles.role}>代理商工作台</Text>
        </View>

        {/* 快捷菜单 */}
        <AppCard padding={0}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.menuItem, idx < menuItems.length - 1 && styles.menuBorder]}
              onPress={() => {
                if (item.copyable && item.value) {
                  Clipboard.setStringAsync(item.value);
                  Alert.alert('已复制', '分享码已复制到剪贴板');
                } else if (item.screen) {
                  navigation.navigate(item.screen);
                }
              }}
              activeOpacity={0.6}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              {item.value ? (
                <Text style={styles.menuValue}>{item.value}</Text>
              ) : (
                <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT_PLACEHOLDER} />
              )}
            </TouchableOpacity>
          ))}
        </AppCard>

        {/* 退出 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color={COLORS.DANGER} />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  header: { alignItems: 'center', padding: 20, marginBottom: 8 },
  name: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT, marginTop: 8 },
  role: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY, marginTop: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  menuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuLabel: { flex: 1, fontSize: FONT.BODY, color: COLORS.TEXT },
  menuValue: { fontSize: FONT.SMALL, color: COLORS.PRIMARY, fontWeight: '600' },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: { fontSize: FONT.BODY, color: COLORS.DANGER, fontWeight: '500' },
});