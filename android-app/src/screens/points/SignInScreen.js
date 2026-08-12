import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import AppButton from '../../components/AppButton';
import { pointsApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export default function SignInScreen() {
  const [status, setStatus] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [statusRes, recordsRes] = await Promise.all([
        pointsApi.getSignInStatus().catch(() => null),
        pointsApi.getSignInRecords({ page: 1, pageSize: 30 }).catch(() => null),
      ]);
      if (statusRes?.success) setStatus(statusRes.data);
      if (recordsRes?.success) setRecords(recordsRes.data?.list || []);
    } catch (e) { /* ignore */ }
  };

  const handleSignIn = async () => {
    setLoading(true);
    try {
      const res = await pointsApi.signIn();
      if (res.success) {
        Alert.alert('签到成功', `获得 ${res.data?.points || 0} 积分`);
        loadData();
      }
    } catch (err) {
      Alert.alert('签到失败', err.message);
    }
    setLoading(false);
  };

  // 获取本月日历
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();

  const signedDates = new Set(records.map(r => {
    const d = new Date(r.created_at || r.createdAt);
    return d.getDate();
  }));

  const isTodaySigned = status?.signedToday || signedDates.has(today.getDate());

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 签到状态 */}
        <AppCard>
          <View style={styles.statusRow}>
            <Ionicons
              name={isTodaySigned ? 'checkmark-circle' : 'calendar'}
              size={40}
              color={isTodaySigned ? COLORS.SUCCESS : COLORS.PRIMARY}
            />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>
                {isTodaySigned ? '今日已签到' : '今日未签到'}
              </Text>
              <Text style={styles.statusDesc}>
                {isTodaySigned ? '明天再来吧' : '签到获取积分奖励'}
              </Text>
            </View>
          </View>
          {!isTodaySigned && (
            <AppButton
              title="立即签到"
              onPress={handleSignIn}
              loading={loading}
              style={styles.signBtn}
            />
          )}
        </AppCard>

        {/* 连续签到统计 */}
        {status && (
          <AppCard>
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text style={styles.streakNum}>{status.consecutiveDays || 0}</Text>
                <Text style={styles.streakLabel}>连续签到(天)</Text>
              </View>
              <View style={styles.streakDivider} />
              <View style={styles.streakItem}>
                <Text style={styles.streakNum}>{status.totalDays || 0}</Text>
                <Text style={styles.streakLabel}>累计签到(天)</Text>
              </View>
            </View>
          </AppCard>
        )}

        {/* 日历 */}
        <Text style={styles.sectionTitle}>
          {year}年{month + 1}月
        </Text>
        <AppCard>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((w, i) => (
              <Text key={i} style={styles.weekday}>{w}</Text>
            ))}
          </View>
          <View style={styles.calendarGrid}>
            {calendarDays.map((day, idx) => (
              <View key={idx} style={styles.calendarCell}>
                {day ? (
                  <View style={[
                    styles.calendarDay,
                    signedDates.has(day) && styles.calendarSigned,
                    day === today.getDate() && styles.calendarToday,
                  ]}>
                    <Text style={[
                      styles.calendarText,
                      signedDates.has(day) && styles.calendarTextSigned,
                      day === today.getDate() && styles.calendarTextToday,
                    ]}>
                      {day}
                    </Text>
                    {signedDates.has(day) && (
                      <Ionicons name="checkmark" size={12} color={COLORS.WHITE} style={styles.checkIcon} />
                    )}
                  </View>
                ) : <View />}
              </View>
            ))}
          </View>
        </AppCard>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusText: { marginLeft: 12, flex: 1 },
  statusTitle: { fontSize: FONT.TITLE, fontWeight: '600', color: COLORS.TEXT },
  statusDesc: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  signBtn: { marginTop: 8 },
  streakRow: { flexDirection: 'row', alignItems: 'center' },
  streakItem: { flex: 1, alignItems: 'center' },
  streakNum: { fontSize: 32, fontWeight: '700', color: COLORS.PRIMARY },
  streakLabel: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginTop: 4 },
  streakDivider: { width: 1, height: 40, backgroundColor: COLORS.BORDER },
  sectionTitle: {
    fontSize: FONT.TITLE,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  weekdayRow: { flexDirection: 'row', marginBottom: 8 },
  weekday: { flex: 1, textAlign: 'center', fontSize: 14, color: COLORS.TEXT_PLACEHOLDER, fontWeight: '500' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarCell: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center', padding: 2 },
  calendarDay: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  calendarSigned: { backgroundColor: COLORS.PRIMARY },
  calendarToday: { borderWidth: 2, borderColor: COLORS.PRIMARY },
  calendarText: { fontSize: 14, color: COLORS.TEXT, fontWeight: '500' },
  calendarTextSigned: { color: COLORS.WHITE },
  calendarTextToday: { fontWeight: '700' },
  checkIcon: { position: 'absolute', top: 1, right: 1 },
});