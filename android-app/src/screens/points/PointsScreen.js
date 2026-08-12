import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { pointsApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';
import { formatDateTime, formatPoints } from '../../utils/format';

export default function PointsScreen({ navigation }) {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [overview, setOverview] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [historyRes, overviewRes] = await Promise.all([
        pointsApi.getHistory({ page: 1, pageSize: 20 }).catch(() => null),
        pointsApi.getOverview().catch(() => null),
      ]);
      if (historyRes?.success) setHistory(historyRes.data?.list || []);
      if (overviewRes?.success) setOverview(overviewRes.data);
    } catch (e) { /* ignore */ }
  };

  const quickLinks = [
    { icon: 'calendar', label: '每日签到', screen: 'SignIn', color: '#9C27B0' },
    { icon: 'book', label: '健康课程', screen: 'CourseList', color: '#00BCD4' },
    { icon: 'gift', label: '积分商城', screen: 'GiftList', color: '#E91E63' },
  ];

  return (
    <SafeView>
      <ScrollView style={styles.scroll}>
        {/* 积分总览 */}
        <AppCard>
          <View style={styles.pointsHeader}>
            <Text style={styles.pointsTitle}>我的积分</Text>
            <TouchableOpacity onPress={() => navigation.navigate('GiftList')}>
              <Text style={styles.exchangeLink}>去兑换</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.pointsAmount}>{user?.points ?? 0}</Text>
          <View style={styles.pointsStats}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>累计获得</Text>
              <Text style={styles.statValue}>{overview?.totalEarned ?? user?.totalPoints ?? 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>冻结积分</Text>
              <Text style={styles.statValue}>{overview?.frozenPoints ?? user?.frozenPoints ?? 0}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>已使用</Text>
              <Text style={styles.statValue}>{overview?.totalSpent ?? 0}</Text>
            </View>
          </View>
        </AppCard>

        {/* 快捷入口 */}
        <View style={styles.quickRow}>
          {quickLinks.map((item, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.quickItem}
              onPress={() => navigation.navigate(item.screen)}
              activeOpacity={0.7}
            >
              <View style={[styles.quickIcon, { backgroundColor: item.color + '20' }]}>
                <Ionicons name={item.icon} size={28} color={item.color} />
              </View>
              <Text style={styles.quickLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 积分历史 */}
        <Text style={styles.sectionTitle}>积分记录</Text>
        {history.length === 0 ? (
          <AppCard>
            <Text style={styles.emptyText}>暂无积分记录</Text>
          </AppCard>
        ) : (
          history.map((item, idx) => (
            <View key={item.id || idx} style={styles.historyItem}>
              <View style={styles.historyInfo}>
                <Text style={styles.historySource}>{item.source_name || item.source}</Text>
                <Text style={styles.historyDate}>{formatDateTime(item.created_at)}</Text>
              </View>
              <Text style={[styles.historyPoints, { color: item.points > 0 ? COLORS.SUCCESS : COLORS.DANGER }]}>
                {formatPoints(item.points)}
              </Text>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  pointsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pointsTitle: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY },
  exchangeLink: { fontSize: FONT.SMALL, color: COLORS.PRIMARY, fontWeight: '600' },
  pointsAmount: { fontSize: 48, fontWeight: '700', color: COLORS.TEXT, marginBottom: 16 },
  pointsStats: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.BORDER, paddingTop: 12 },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginBottom: 4 },
  statValue: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT },
  quickRow: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8, gap: 12 },
  quickItem: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  quickIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  quickLabel: { fontSize: 13, color: COLORS.TEXT, fontWeight: '500' },
  sectionTitle: {
    fontSize: FONT.TITLE,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  historyInfo: { flex: 1 },
  historySource: { fontSize: FONT.BODY, color: COLORS.TEXT, marginBottom: 2 },
  historyDate: { fontSize: 13, color: COLORS.TEXT_PLACEHOLDER },
  historyPoints: { fontSize: 20, fontWeight: '700' },
  emptyText: { textAlign: 'center', fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER, padding: 16 },
});