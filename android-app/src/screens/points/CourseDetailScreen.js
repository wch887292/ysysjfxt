import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppButton from '../../components/AppButton';
import { pointsApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

export default function CourseDetailScreen({ route, navigation }) {
  const { courseId, course } = route.params;
  const [learning, setLearning] = useState(false);

  const handleStart = async () => {
    setLearning(true);
    try {
      await pointsApi.startCourse(courseId);
      Alert.alert('开始学习', '请认真学习课程内容', [
        {
          text: '完成学习',
          onPress: async () => {
            try {
              const res = await pointsApi.completeCourse(courseId, 100);
              Alert.alert('学习完成', `获得 ${res.data?.points || 0} 积分`);
              navigation.goBack();
            } catch (err) {
              Alert.alert('提交失败', err.message);
            }
          }
        },
        { text: '继续学习' },
      ]);
    } catch (err) {
      Alert.alert('启动失败', err.message);
    }
    setLearning(false);
  };

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: '#E8F5E9' }]}>
            <Ionicons name="book" size={48} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.title}>{course?.title || '课程'}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>⏱ {course?.duration || '未知'}分钟</Text>
            <Text style={styles.metaItem}>⭐ {course?.points || 0}积分</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>课程介绍</Text>
          <Text style={styles.content}>{course?.description || '暂无介绍'}</Text>
        </View>

        {course?.content && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>课程内容</Text>
            <Text style={styles.content}>{course.content}</Text>
          </View>
        )}

        <AppButton
          title={learning ? '正在加载...' : '开始学习'}
          onPress={handleStart}
          loading={learning}
          style={styles.startBtn}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  header: { alignItems: 'center', marginBottom: 24 },
  iconWrap: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.TEXT, marginBottom: 8, textAlign: 'center' },
  metaRow: { flexDirection: 'row', gap: 20 },
  metaItem: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: FONT.TITLE, fontWeight: '600', color: COLORS.TEXT, marginBottom: 8 },
  content: { fontSize: FONT.BODY, color: COLORS.TEXT, lineHeight: FONT.BODY * 1.8 },
  startBtn: { marginTop: 16 },
});