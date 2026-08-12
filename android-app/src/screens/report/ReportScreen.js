import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import AppButton from '../../components/AppButton';
import EmptyState from '../../components/EmptyState';
import { useAuth } from '../../context/AuthContext';
import { healthApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

export default function ReportScreen({ navigation }) {
  const { isMember } = useAuth();
  const [crisisReport, setCrisisReport] = useState(null);
  const [sevenDayPlan, setSevenDayPlan] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [crisisRes, planRes] = await Promise.all([
        healthApi.getCrisisHookReport().catch(() => null),
        isMember ? healthApi.getMy7DayPlan().catch(() => null) : Promise.resolve(null),
      ]);
      if (crisisRes?.success) setCrisisReport(crisisRes.data);
      if (planRes?.success) setSevenDayPlan(planRes.data);
    } catch (e) { /* ignore */ }
  }, [isMember]);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  if (!crisisReport && !sevenDayPlan) {
    return (
      <SafeView>
        <EmptyState
          message="暂无健康报告"
          actionText="完成健康问卷"
          onAction={() => navigation.navigate('Questionnaire')}
        />
      </SafeView>
    );
  }

  return (
    <SafeView>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>我的报告</Text>
        </View>

        {/* 危机钩子报告 */}
        {crisisReport && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ReportDetail', { report: crisisReport, type: 'crisis_hook' })}
          >
            <AppCard>
              <View style={styles.reportHeader}>
                <Ionicons name="warning" size={24} color={COLORS.WARNING} />
                <Text style={styles.reportType}>危机钩子报告</Text>
              </View>
              <Text style={styles.reportTitle}>{crisisReport.title}</Text>
              <View style={styles.reportMeta}>
                <Text style={[styles.riskBadge,
                  crisisReport.riskLevel === 'high' ? { backgroundColor: '#FFEBEE', color: COLORS.DANGER }
                    : crisisReport.riskLevel === 'medium' ? { backgroundColor: '#FFF3E0', color: COLORS.WARNING }
                      : { backgroundColor: '#E8F5E9', color: COLORS.SUCCESS }
                ]}>
                  {crisisReport.riskLevel === 'high' ? '高风险' : crisisReport.riskLevel === 'medium' ? '中风险' : '低风险'}
                </Text>
                <Text style={styles.riskScore}>评分：{crisisReport.riskScore}</Text>
              </View>
              <Text style={styles.preview} numberOfLines={3}>
                {typeof crisisReport.content === 'string' ? crisisReport.content : '点击查看详情'}
              </Text>
            </AppCard>
          </TouchableOpacity>
        )}

        {/* 7天调理方案 */}
        {sevenDayPlan && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => navigation.navigate('ReportDetail', { report: sevenDayPlan, type: '7day_plan' })}
          >
            <AppCard style={styles.planCard}>
              <View style={styles.reportHeader}>
                <Ionicons name="calendar" size={24} color={COLORS.PRIMARY} />
                <Text style={styles.reportType}>7天调理方案</Text>
              </View>
              <Text style={styles.reportTitle}>{sevenDayPlan.title}</Text>
              <View style={styles.reportMeta}>
                <Text style={[styles.riskBadge,
                  sevenDayPlan.riskLevel === 'high' ? { backgroundColor: '#FFEBEE', color: COLORS.DANGER }
                    : sevenDayPlan.riskLevel === 'medium' ? { backgroundColor: '#FFF3E0', color: COLORS.WARNING }
                      : { backgroundColor: '#E8F5E9', color: COLORS.SUCCESS }
                ]}>
                  {sevenDayPlan.riskLevel === 'high' ? '高风险' : sevenDayPlan.riskLevel === 'medium' ? '中风险' : '低风险'}
                </Text>
              </View>
            </AppCard>
          </TouchableOpacity>
        )}

        {/* 会员引导 */}
        {!isMember && (
          <AppCard style={styles.memberCard}>
            <Text style={styles.memberTitle}>🔒 会员专属</Text>
            <Text style={styles.memberDesc}>开通会员可查看7天调理方案详情</Text>
          </AppCard>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  header: { padding: 20, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT },
  reportHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  reportType: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT },
  reportTitle: { fontSize: 20, fontWeight: '700', color: COLORS.TEXT, marginBottom: 8 },
  reportMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  riskBadge: {
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    overflow: 'hidden',
  },
  riskScore: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY },
  preview: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY, lineHeight: FONT.BODY * 1.8 },
  planCard: { borderLeftWidth: 4, borderLeftColor: COLORS.PRIMARY },
  memberCard: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE082' },
  memberTitle: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT, marginBottom: 4 },
  memberDesc: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY },
});