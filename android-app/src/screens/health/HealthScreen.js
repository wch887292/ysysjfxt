import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import { useAuth } from '../../context/AuthContext';
import { healthApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

export default function HealthScreen({ navigation }) {
  const { user, isMember } = useAuth();
  const [report, setReport] = useState(null);
  const [questionnaire, setQuestionnaire] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [reportRes, qRes] = await Promise.all([
        healthApi.getCrisisHookReport().catch(() => null),
        healthApi.getQuestionnaireResult().catch(() => null),
      ]);
      if (reportRes?.success) setReport(reportRes.data);
      if (qRes?.success) setQuestionnaire(qRes.data.questionnaire);
    } catch (e) { /* ignore */ }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  const hasQuestionnaire = user?.questionnaireCompleted || !!questionnaire;
  const hasReport = !!report;

  return (
    <SafeView>
      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>健康管理</Text>
          <Text style={styles.subtitle}>了解您的健康状况，获取个性化建议</Text>
        </View>

        {/* 健康评估状态 */}
        <AppCard>
          <View style={styles.statusRow}>
            <Ionicons
              name={hasQuestionnaire ? 'checkmark-circle' : 'alert-circle'}
              size={28}
              color={hasQuestionnaire ? COLORS.SUCCESS : COLORS.WARNING}
            />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>
                {hasQuestionnaire ? '已完成健康评估' : '尚未完成健康评估'}
              </Text>
              <Text style={styles.statusDesc}>
                {hasQuestionnaire
                  ? `风险评分：${questionnaire?.risk_score ?? report?.riskScore ?? '-'} 分`
                  : '完成问卷获取个性化健康报告'}
              </Text>
            </View>
          </View>
        </AppCard>

        {/* 主要操作区 */}
        <View style={styles.actionArea}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Questionnaire')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E8F5E9' }]}>
              <Ionicons name="clipboard" size={32} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.actionTitle}>健康问卷</Text>
            <Text style={styles.actionDesc}>完成问卷，获取AI健康分析</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('Report')}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#E3F2FD' }]}>
              <Ionicons name="document-text" size={32} color="#2196F3" />
            </View>
            <Text style={styles.actionTitle}>健康报告</Text>
            <Text style={styles.actionDesc}>查看危机钩子与调理方案</Text>
          </TouchableOpacity>
        </View>

        {/* 报告预览 */}
        {hasReport && (
          <>
            <Text style={styles.sectionTitle}>最新报告</Text>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('ReportDetail', { reportId: report.id, report })}
            >
              <AppCard>
                <Text style={styles.reportTitle}>{report.title}</Text>
                <View style={styles.reportMeta}>
                  <Text style={styles.riskLabel}>
                    风险等级：
                    <Text style={{
                      color: report.riskLevel === 'high' ? COLORS.DANGER
                        : report.riskLevel === 'medium' ? COLORS.WARNING : COLORS.SUCCESS,
                      fontWeight: '600',
                    }}>
                      {report.riskLevel === 'high' ? '高风险' : report.riskLevel === 'medium' ? '中风险' : '低风险'}
                    </Text>
                  </Text>
                  <Text style={styles.riskScore}>评分：{report.riskScore}</Text>
                </View>
              </AppCard>
            </TouchableOpacity>
          </>
        )}

        {/* 会员提示 */}
        {!isMember && (
          <AppCard style={styles.memberCard}>
            <Text style={styles.memberTitle}>🔒 会员专属</Text>
            <Text style={styles.memberDesc}>开通会员可查看完整的7天调理方案</Text>
          </AppCard>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  header: { padding: 20, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT, marginBottom: 4 },
  subtitle: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  statusText: { marginLeft: 12, flex: 1 },
  statusTitle: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT },
  statusDesc: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginTop: 2 },
  actionArea: { flexDirection: 'row', paddingHorizontal: 16, marginTop: 8, gap: 12 },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  actionIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT, marginBottom: 4 },
  actionDesc: { fontSize: 13, color: COLORS.TEXT_SECONDARY, textAlign: 'center', lineHeight: 18 },
  sectionTitle: {
    fontSize: FONT.TITLE,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  reportTitle: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT, marginBottom: 8 },
  reportMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  riskLabel: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY },
  riskScore: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY },
  memberCard: { backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: '#FFE082' },
  memberTitle: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT, marginBottom: 4 },
  memberDesc: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY },
});