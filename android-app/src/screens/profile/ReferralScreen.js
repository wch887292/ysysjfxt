import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import { authApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';
import { formatDate } from '../../utils/format';

export default function ReferralScreen() {
  const [stats, setStats] = useState(null);
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [statsRes, refRes] = await Promise.all([
          authApi.getMyReferralStats(),
          authApi.getMyReferrals(1, 50),
        ]);
        if (statsRes.success) setStats(statsRes.data);
        if (refRes.success) setReferrals(refRes.data.referrals || []);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  if (loading) return <SafeView><ActivityIndicator style={{ marginTop: 60 }} /></SafeView>;

  return (
    <SafeView>
      <FlatList
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {/* 统计 */}
            <AppCard>
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{stats?.total || 0}</Text>
                  <Text style={styles.statLabel}>总推荐</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{stats?.completed || 0}</Text>
                  <Text style={styles.statLabel}>已完成</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{stats?.rewardPoints || 0}</Text>
                  <Text style={styles.statLabel}>奖励积分</Text>
                </View>
              </View>
            </AppCard>

            <Text style={styles.sectionTitle}>推荐记录</Text>
          </>
        }
        data={referrals}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.avatar}>
              <Ionicons name="person" size={24} color={COLORS.TEXT_SECONDARY} />
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{item.nickName || '用户'}</Text>
              <Text style={styles.date}>{formatDate(item.createdAt)}</Text>
            </View>
            <View style={[styles.status, item.questionnaireCompleted && styles.statusDone]}>
              <Text style={[styles.statusText, item.questionnaireCompleted && { color: COLORS.WHITE }]}>
                {item.questionnaireCompleted ? '已完成' : '未完成'}
              </Text>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>暂无推荐记录</Text>
        }
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statItem: { flex: 1, alignItems: 'center' },
  statNum: { fontSize: 28, fontWeight: '700', color: COLORS.PRIMARY },
  statLabel: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginTop: 4 },
  statDivider: { width: 1, height: 36, backgroundColor: COLORS.BORDER },
  sectionTitle: { fontSize: FONT.TITLE, fontWeight: '600', color: COLORS.TEXT, marginTop: 16, marginBottom: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.BG,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontSize: FONT.BODY, fontWeight: '500', color: COLORS.TEXT },
  date: { fontSize: 13, color: COLORS.TEXT_PLACEHOLDER, marginTop: 2 },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FFF3E0' },
  statusDone: { backgroundColor: COLORS.PRIMARY },
  statusText: { fontSize: 13, color: COLORS.WARNING, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 40, fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER },
});