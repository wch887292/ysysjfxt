// PrivacyPolicyScreen.js - 隐私政策页面
import React from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import SafeView from '../../components/SafeView';
import { COLORS, FONT } from '../../utils/constants';

export default function PrivacyPolicyScreen() {
  const navigation = useNavigation();

  return (
    <SafeView>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.backText}>返回</Text>
        </TouchableOpacity>
        <Text style={styles.title}>隐私政策</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.intro}>
          快乐AI饮食健康积分系统（以下简称"我们"）深知个人信息对您的重要性，并会尽全力保护您的个人信息安全可靠。我们致力于维持您对我们的信任，恪守以下原则，保护您的个人信息：权责一致原则、目的明确原则、选择同意原则、最少够用原则、确保安全原则、主体参与原则、公开透明原则等。
        </Text>

        <Text style={styles.sectionTitle}>一、我们如何收集和使用您的个人信息</Text>
        <Text style={styles.paragraph}>
          我们仅会出于以下目的，收集和使用您的个人信息：
        </Text>
        <Text style={styles.subParagraph}>
          1. 账号注册与登录：当您使用手机号注册账号时，我们会收集您的手机号用于账号创建和身份验证。
        </Text>
        <Text style={styles.subParagraph}>
          2. 健康饮食管理：当您使用打卡、问卷、课程等功能时，我们会收集您的饮食记录、健康评估结果等信息，用于为您提供个性化的健康建议。
        </Text>
        <Text style={styles.subParagraph}>
          3. 积分与礼品兑换：当您参与积分活动时，我们会记录您的积分获取和消耗情况，用于礼品兑换。
        </Text>
        <Text style={styles.subParagraph}>
          4. 客户服务：当您联系客服或反馈问题时，我们会收集您的联系方式和问题描述，用于为您提供服务。
        </Text>

        <Text style={styles.sectionTitle}>二、我们如何共享、转让、公开披露您的个人信息</Text>
        <Text style={styles.paragraph}>
          我们不会与快乐AI饮食健康积分系统服务使用者、供应商、代理及任何第三方共享、转让您的个人信息，除非：
        </Text>
        <Text style={styles.subParagraph}>
          1. 获得您的明确同意或授权；
        </Text>
        <Text style={styles.subParagraph}>
          2. 根据法律法规的规定或政府主管部门的强制性要求；
        </Text>
        <Text style={styles.subParagraph}>
          3. 与我们的关联公司共享，且仅出于合法目的，受本政策约束。
        </Text>

        <Text style={styles.sectionTitle}>三、我们如何保护您的个人信息</Text>
        <Text style={styles.paragraph}>
          我们采取适当的技术和组织措施来保护您的个人信息，包括但不限于：加密存储（手机号等敏感信息采用AES加密）、访问控制、数据脱敏等。您的个人信息将被存储在中国境内的服务器上。
        </Text>

        <Text style={styles.sectionTitle}>四、您的权利</Text>
        <Text style={styles.paragraph}>
          您有权访问、更正、删除您的个人信息，有权撤回对个人信息处理的同意，有权注销账号。如您行使上述权利，请通过我们的客服渠道联系我们。
        </Text>

        <Text style={styles.sectionTitle}>五、未成年人保护</Text>
        <Text style={styles.paragraph}>
          我们高度重视未成年人个人信息保护。若您是未满18周岁的未成年人，请在监护人陪同下阅读本政策，并在征得监护人同意后使用我们的服务。
        </Text>

        <Text style={styles.sectionTitle}>六、本政策的更新</Text>
        <Text style={styles.paragraph}>
          我们可能会适时修订本政策。当政策发生重大变更时，我们会通过应用内通知或站内消息等方式告知您。
        </Text>

        <Text style={styles.footer}>
          更新日期：2025年8月
          {'\n\n'}
          联系我们：admin@klai.top
        </Text>
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    backgroundColor: COLORS.WHITE,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginLeft: -8,
  },
  backText: {
    fontSize: FONT.BODY,
    color: COLORS.PRIMARY,
    marginLeft: 4,
  },
  title: {
    fontSize: FONT.TITLE,
    fontWeight: '700',
    color: COLORS.TEXT,
    flex: 1,
    textAlign: 'center',
    marginRight: 48,
  },
  content: {
    flex: 1,
    backgroundColor: COLORS.WHITE,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  intro: {
    fontSize: FONT.BODY,
    color: COLORS.TEXT,
    lineHeight: FONT.BODY * 1.8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: FONT.SUBTITLE,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 20,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: FONT.BODY,
    color: COLORS.TEXT,
    lineHeight: FONT.BODY * 1.8,
    marginBottom: 8,
  },
  subParagraph: {
    fontSize: FONT.BODY,
    color: COLORS.TEXT,
    lineHeight: FONT.BODY * 1.8,
    marginBottom: 6,
    paddingLeft: 16,
  },
  footer: {
    fontSize: FONT.SMALL,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: FONT.SMALL * 1.8,
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
});
