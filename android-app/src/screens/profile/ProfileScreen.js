import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT, HONOR_LEVELS } from '../../utils/constants';
import { maskPhone } from '../../utils/format';

export default function ProfileScreen({ navigation }) {
  const { user, logout, isAdmin, isAgent } = useAuth();

  const handleLogout = () => {
    Alert.alert('确认退出', '确定要退出登录吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '退出',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        },
      },
    ]);
  };

  const menuItems = [
    { icon: 'person', label: '编辑资料', screen: 'EditProfile', color: '#4CAF50' },
    { icon: 'share', label: '我的推荐', screen: 'Referral', color: '#2196F3' },
    { icon: 'shield', label: '隐私设置', screen: 'PrivacySettings', color: '#9C27B0' },
    { icon: 'newspaper', label: '健康资讯', screen: 'Articles', color: '#FF9800' },
    { icon: 'lock-closed', label: '修改密码', screen: 'ChangePassword', color: '#607D8B' },
  ];

  const honorLabel = HONOR_LEVELS[user?.honorLevel] || user?.honorLevel || '健康新人';

  return (
    <SafeView>
      <ScrollView style={styles.scroll}>
        {/* 用户信息 */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrap}>
            <Ionicons name="person-circle" size={72} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.nickName}>{user?.nickName || '用户'}</Text>
          <View style={styles.badges}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{honorLabel}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: '#E3F2FD' }]}>
              <Text style={[styles.badgeText, { color: '#1565C0' }]}>
                {user?.isMember ? '会员' : '用户'}
              </Text>
            </View>
          </View>
          {user?.phone && (
            <Text style={styles.phone}>{maskPhone(user.phone)}</Text>
          )}
        </View>

        {/* 菜单列表 */}
        <AppCard padding={0}>
          {menuItems.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={[styles.menuItem, idx < menuItems.length - 1 && styles.menuBorder]}
              onPress={() => {
                if (item.screen === 'ChangePassword') {
                  Alert.alert('提示', '密码修改功能请联系管理员或在后台操作');
                } else {
                  navigation.navigate(item.screen);
                }
              }}
              activeOpacity={0.6}
            >
              <View style={[styles.menuIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={22} color={item.color} />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT_PLACEHOLDER} />
            </TouchableOpacity>
          ))}
        </AppCard>

        {/* 退出登录 */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out" size={22} color={COLORS.DANGER} />
          <Text style={styles.logoutText}>退出登录</Text>
        </TouchableOpacity>

        <Text style={styles.version}>快乐AI饮食健康积分系统 v1.1.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  profileHeader: { alignItems: 'center', padding: 24, paddingTop: 12 },
  avatarWrap: { marginBottom: 12 },
  nickName: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT, marginBottom: 8 },
  badges: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#E8F5E9' },
  badgeText: { fontSize: 13, color: COLORS.PRIMARY, fontWeight: '500' },
  phone: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY },
  menuItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  menuBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.BORDER },
  menuIcon: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  menuLabel: { flex: 1, fontSize: FONT.BODY, color: COLORS.TEXT },
  logoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    gap: 8,
  },
  logoutText: { fontSize: FONT.BODY, color: COLORS.DANGER, fontWeight: '500' },
  version: { textAlign: 'center', marginTop: 16, fontSize: 13, color: COLORS.TEXT_PLACEHOLDER },
});