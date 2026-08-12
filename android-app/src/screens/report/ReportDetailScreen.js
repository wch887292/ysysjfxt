import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import { COLORS, FONT } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

export default function ReportDetailScreen({ route }) {
  const { report, type } = route.params || {};

  if (!report) {
    return (
      <SafeView>
        <View style={styles.error}>
          <Text style={styles.errorText}>报告数据不可用</Text>
        </View>
      </SafeView>
    );
  }

  const isPlan = type === '7day_plan';
  const riskColor = report.riskLevel === 'high' ? COLORS.DANGER
    : report.riskLevel === 'medium' ? COLORS.WARNING : COLORS.SUCCESS;
  const riskLabel = report.riskLevel === 'high' ? '高风险'
    : report.riskLevel === 'medium' ? '中风险' : '低风险';

  // 处理内容 - 可能是纯文本或JSON
  let content = report.content;
  let sections = [];
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.sections) {
        sections = parsed.sections;
        content = null;
      } else {
        content = parsed.content || parsed;
      }
    } catch (e) {
      // 纯文本，直接使用
    }
  } else if (content?.sections) {
    sections = content.sections;
    content = null;
  }

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 报告头 */}
        <View style={styles.header}>
          <Ionicons
            name={isPlan ? 'calendar' : 'warning'}
            size={32}
            color={isPlan ? COLORS.PRIMARY : COLORS.WARNING}
          />
          <Text style={styles.title}>{report.title || (isPlan ? '7天调理方案' : '危机钩子报告')}</Text>
        </View>

        {/* 风险信息 */}
        <View style={[styles.riskBar, { backgroundColor: riskColor + '15' }]}>
          <View style={[styles.riskDot, { backgroundColor: riskColor }]} />
          <Text style={[styles.riskText, { color: riskColor }]}>
            风险等级：{riskLabel}（评分：{report.riskScore}）
          </Text>
        </View>

        {/* 报告内容 */}
        {sections.length > 0 ? (
          sections.map((section, idx) => (
            <View key={idx} style={styles.section}>
              {section.title && <Text style={styles.sectionTitle}>{section.title}</Text>}
              <Text style={styles.sectionContent}>{section.content}</Text>
            </View>
          ))
        ) : content ? (
          <View style={styles.contentBlock}>
            <Text style={styles.contentText}>{content}</Text>
          </View>
        ) : null}

        {/* 免责声明 */}
        <View style={styles.disclaimer}>
          <Ionicons name="alert-circle" size={18} color={COLORS.TEXT_PLACEHOLDER} />
          <Text style={styles.disclaimerText}>
            本报告由AI生成，仅供参考，不构成医疗诊断。健康决策请咨询专业医师。
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  error: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorText: { fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER },
  header: { alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.TEXT, marginTop: 8, textAlign: 'center' },
  riskBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  riskDot: { width: 10, height: 10, borderRadius: 5 },
  riskText: { fontSize: FONT.BODY, fontWeight: '600' },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: FONT.TITLE, fontWeight: '600', color: COLORS.TEXT, marginBottom: 8 },
  sectionContent: { fontSize: FONT.BODY, color: COLORS.TEXT, lineHeight: FONT.BODY * 1.8 },
  contentBlock: { marginBottom: 20 },
  contentText: { fontSize: FONT.BODY, color: COLORS.TEXT, lineHeight: FONT.BODY * 1.8 },
  disclaimer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    gap: 8,
    alignItems: 'flex-start',
  },
  disclaimerText: {
    flex: 1,
    fontSize: FONT.SMALL,
    color: COLORS.TEXT_PLACEHOLDER,
    lineHeight: FONT.SMALL * 1.8,
  },
});