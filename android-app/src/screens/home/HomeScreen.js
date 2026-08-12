import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { userApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

export default function HomeScreen({ navigation }) {
  const { user, isMember } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const res = await userApi.getDashboard();
      if (res.success) setDashboard(res.data);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDashboard();
    setRefreshing(false);
  }, [loadDashboard]);

  const quickActions = [
    { icon: 'clipboard', label: '健康问卷', screen: 'Questionnaire', color: '#4CAF50' },
    { icon: 'document-text', label: '健康报告', screen: 'Report', color: '#2196F3' },
    { icon: 'camera', label: '饮食打卡', screen: 'ClockIn', color: '#FF9800' },
    { icon: 'calendar', label: '每日签到', screen: 'SignIn', color: '#9C27B0' },
    { icon: 'book', label: '健康课程', screen: 'CourseList', color: '#00BCD4' },
    { icon: 'gift', label: '积分商城', screen: 'GiftList', color: '#E91E63' },
  ];

  return (
    <SafeView>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* 用户信息头部 */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>
              你好，{user?.nickName || '用户'}
            </Text>
            <Text style={styles.role}>
              {isMember ? '👑 会员用户' : '💚 普通用户'}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => navigation.navigate('Profile')}
          >
            <Ionicons name="person-circle" size={56} color={COLORS.PRIMARY} />
          </TouchableOpacity>
        </View>

        {/* 积分概览 */}
        <AppCard>
          <View style={styles.pointsRow}>
            <View style={styles.pointsItem}>
              <Text style={styles.pointsLabel}>可用积分</Text>
              <Text style={styles.pointsValue}>{dashboard?.points ?? user?.points ?? 0}</Text>
            </View>
            <View style={styles.pointsDivider} />
            <View style={styles.pointsItem}>
              <Text style={styles.pointsLabel}>今日获得</Text>
              <Text style={[styles.pointsValue, { color: COLORS.SECONDARY }]}>
                +{dashboard?.todayPoints ?? 0}
              </Text>
            </View>
            <View style={styles.pointsDivider} />
            <View style={styles.pointsItem}>
              <Text style={styles.pointsLabel}>排名</Text>
              <Text style={styles.pointsValue}>#{dashboard?.ranking ?? '-'}</Text>
            </View>
          </View>
        </AppCard>

        {/* 快捷入口 */}
        <Text style={styles.sectionTitle}>快捷功能</Text>
        <View style={styles.quickGrid}>
          {quickActions.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickItem}
              onPress={() => {
                const tabScreens = ['ClockIn'];
                if (tabScreens.includes(item.screen)) {
                  navigation.navigate('MainTabs', { screen: item.screen });
                } else {
                  navigation.navigate(item.screen);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={28} color={item.color} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 最近饮食记录 */}
        <Text style={styles.sectionTitle}>最近饮食</Text>
        <AppCard>
          {dashboard?.recentMeals?.length > 0 ? (
            dashboard.recentMeals.map((meal, idx) => (
              <View key={meal.id} style={[styles.mealRow, idx > 0 && styles.mealBorder]}>
                <Ionicons name="fast-food" size={20} color={COLORS.SECONDARY} />
                <Text style={styles.mealType}>{meal.meal_type}</Text>
                <Text style={styles.mealPoints}>+{meal.points}分</Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>暂无饮食记录，快去打卡吧</Text>
          )}
        </AppCard>

        {/* 会员引导 */}
        {!isMember && (
          <AppCard style={styles.memberCard}>
            <View style={styles.memberRow}>
              <Ionicons name="crown" size={28} color={COLORS.SECONDARY} />
              <View style={styles.memberText}>
                <Text style={styles.memberTitle}>开通会员</Text>
                <Text style={styles.memberDesc}>查看完整7天调理方案，获取更多健康指导</Text>
              </View>
            </View>
          </AppCard>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 12,
  },
  greeting: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT, marginBottom: 4 },
  role: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY },
  avatar: { padding: 4 },
  pointsRow: { flexDirection: 'row', alignItems: 'center' },
  pointsItem: { flex: 1, alignItems: 'center' },
  pointsLabel: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginBottom: 4 },
  pointsValue: { fontSize: 26, fontWeight: '700', color: COLORS.TEXT },
  pointsDivider: { width: 1, height: 40, backgroundColor: COLORS.BORDER },
  sectionTitle: {
    fontSize: FONT.TITLE,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
  },
  quickItem: {
    width: '33.33%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  quickIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickLabel: { fontSize: 14, color: COLORS.TEXT, fontWeight: '500' },
  mealRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  mealBorder: { borderTopWidth: 1, borderTopColor: COLORS.BORDER },
  mealType: { flex: 1, fontSize: FONT.BODY, color: COLORS.TEXT, marginLeft: 8 },
  mealPoints: { fontSize: FONT.BODY, color: COLORS.SECONDARY, fontWeight: '600' },
  emptyText: { fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER, textAlign: 'center', padding: 16 },
  memberCard: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE082' },
  memberRow: { flexDirection: 'row', alignItems: 'center' },
  memberText: { marginLeft: 12, flex: 1 },
  memberTitle: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT },
  memberDesc: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginTop: 2, lineHeight: FONT.SMALL * 1.8 },
});