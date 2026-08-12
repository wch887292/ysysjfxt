import React, { useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Alert, TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppButton from '../../components/AppButton';
import { healthApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

const QUESTIONS = [
  {
    id: 'age', label: '您的年龄？', type: 'number', options: ['18-25', '26-35', '36-45', '46-55', '56-65', '65以上'],
  },
  {
    id: 'gender', label: '您的性别？', type: 'single', options: ['male', 'female'],
    labels: { male: '男', female: '女' },
  },
  {
    id: 'height', label: '您的身高(cm)？', type: 'number', placeholder: '请输入身高，如170',
  },
  {
    id: 'weight', label: '您的体重(kg)？', type: 'number', placeholder: '请输入体重，如65',
  },
  {
    id: 'chronic_diseases', label: '您是否有以下慢性疾病？（可多选）', type: 'multi',
    options: ['无', '高血压', '糖尿病', '高血脂', '冠心病', '痛风', '其他'],
  },
  {
    id: 'breakfast_habit', label: '您的早餐习惯？', type: 'single',
    options: ['每天吃', '经常吃', '偶尔吃', '很少吃', '从不吃'],
  },
  {
    id: 'vegetable_intake', label: '您每天的蔬菜摄入量？', type: 'single',
    options: ['充足', '适中', '较少', '很少'],
  },
  {
    id: 'exercise_frequency', label: '您的运动频率？', type: 'single',
    options: ['每天', '经常', '偶尔', '从不'],
  },
  {
    id: 'sleep_quality', label: '您的睡眠质量？', type: 'single',
    options: ['很好', '较好', '一般', '较差', '很差'],
  },
  {
    id: 'goals', label: '您的健康目标是什么？（可多选）', type: 'multi',
    options: ['减重', '增肌', '改善饮食', '控制血糖', '控制血压', '改善睡眠', '增强体质'],
  },
];

export default function QuestionnaireScreen({ navigation }) {
  const [answers, setAnswers] = useState({});
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState(false);

  const currentQ = QUESTIONS[step];
  const isLast = step === QUESTIONS.length - 1;
  const isFirst = step === 0;

  const handleAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }));
  };

  const handleMultiToggle = (qId, option) => {
    const current = answers[qId] || [];
    if (option === '无') {
      handleAnswer(qId, ['无']);
      return;
    }
    let next;
    if (current.includes(option)) {
      next = current.filter(v => v !== option);
    } else {
      next = [...current.filter(v => v !== '无'), option];
    }
    handleAnswer(qId, next);
  };

  const handleNext = () => {
    if (!answers[currentQ.id] || (Array.isArray(answers[currentQ.id]) && answers[currentQ.id].length === 0)) {
      Alert.alert('提示', '请先回答当前问题');
      return;
    }
    if (isLast) {
      handleSubmit();
    } else {
      setStep(s => s + 1);
    }
  };

  const handleSubmit = async () => {
    if (!consentAccepted) {
      Alert.alert('提示', '请先阅读并同意隐私政策');
      return;
    }
    setLoading(true);
    try {
      const res = await healthApi.submitQuestionnaire(answers, true);
      if (res.success) {
        Alert.alert('提交成功', '问卷已提交，报告正在生成中，请稍后查看', [
          { text: '确定', onPress: () => navigation.goBack() }
        ]);
      }
    } catch (err) {
      Alert.alert('提交失败', err.message);
    }
    setLoading(false);
  };

  const renderOptions = () => {
    if (currentQ.type === 'number') {
      return (
        <View style={styles.numberHint}>
          <Ionicons name="calculator" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.numberHintText}>{currentQ.placeholder}</Text>
        </View>
      );
    }

    const isMulti = currentQ.type === 'multi';
    const selected = answers[currentQ.id] || (isMulti ? [] : '');

    return (
      <View style={styles.options}>
        {(currentQ.options || []).map((opt) => {
          const label = currentQ.labels?.[opt] || opt;
          const isSelected = isMulti ? selected.includes(opt) : selected === opt;
          return (
            <TouchableOpacity
              key={opt}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => isMulti ? handleMultiToggle(currentQ.id, opt) : handleAnswer(currentQ.id, opt)}
              activeOpacity={0.7}
            >
              <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                {isMulti && (
                  <Ionicons
                    name={isSelected ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={isSelected ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
                  />
                )
                }{' '}{label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        {/* 进度条 */}
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${((step + 1) / QUESTIONS.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>
          第 {step + 1} / {QUESTIONS.length} 题
        </Text>

        {/* 问题 */}
        <Text style={styles.question}>{currentQ.label}</Text>
        {renderOptions()}

        {/* 隐私同意 */}
        {isLast && (
          <TouchableOpacity
            style={styles.consentRow}
            onPress={() => setConsentAccepted(!consentAccepted)}
          >
            <Ionicons
              name={consentAccepted ? 'checkbox' : 'square-outline'}
              size={24}
              color={consentAccepted ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY}
            />
            <Text style={styles.consentText}>
              我已阅读并同意《隐私政策与免责声明》
            </Text>
          </TouchableOpacity>
        )}

        {/* 导航按钮 */}
        <View style={styles.btnRow}>
          {!isFirst && (
            <AppButton
              title="上一题"
              type="outline"
              onPress={() => setStep(s => s - 1)}
              style={styles.btn}
            />
          )}
          <AppButton
            title={isLast ? '提交问卷' : '下一题'}
            onPress={handleNext}
            loading={loading}
            style={[styles.btn, isFirst && { flex: 1 }]}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  progressBar: {
    height: 6,
    backgroundColor: COLORS.BORDER,
    borderRadius: 3,
    marginBottom: 8,
  },
  progressFill: {
    height: 6,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 3,
  },
  progressText: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginBottom: 24 },
  question: { fontSize: 22, fontWeight: '700', color: COLORS.TEXT, marginBottom: 24, lineHeight: 32 },
  options: { gap: 8 },
  option: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.BORDER,
    backgroundColor: COLORS.WHITE,
  },
  optionSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  optionText: {
    fontSize: FONT.BODY,
    color: COLORS.TEXT,
    lineHeight: FONT.BODY * 1.5,
  },
  optionTextSelected: { color: COLORS.PRIMARY_DARK, fontWeight: '600' },
  numberHint: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#F0F9F0',
    borderRadius: 12,
    gap: 12,
  },
  numberHintText: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY },
  consentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    padding: 12,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    gap: 8,
  },
  consentText: { fontSize: FONT.SMALL, color: COLORS.TEXT, flex: 1 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  btn: { flex: 1 },
});