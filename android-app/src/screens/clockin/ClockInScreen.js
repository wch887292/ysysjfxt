import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import SafeView from '../../components/SafeView';
import AppCard from '../../components/AppCard';
import AppButton from '../../components/AppButton';
import { clockinApi } from '../../api';
import { COLORS, FONT, MEAL_TYPES } from '../../utils/constants';

export default function ClockInScreen() {
  const [selectedMeals, setSelectedMeals] = useState([]);
  const [photo, setPhoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [todaySummary, setTodaySummary] = useState(null);

  useEffect(() => {
    loadTodaySummary();
    (async () => {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('提示', '需要相机权限才能拍照打卡');
      }
    })();
  }, []);

  const loadTodaySummary = async () => {
    try {
      const res = await clockinApi.getTodaySummary();
      if (res.success) setTodaySummary(res.data);
    } catch (e) { /* ignore */ }
  };

  const toggleMeal = (key) => {
    if (key === 'photo') {
      handleTakePhoto();
      return;
    }
    setSelectedMeals(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleTakePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      base64: false,
    });
    if (!result.canceled && result.assets?.[0]) {
      setPhoto(result.assets[0].uri);
    }
  };

  const handleSubmit = async () => {
    if (selectedMeals.length === 0) {
      Alert.alert('提示', '请至少选择一项饮食');
      return;
    }
    setSubmitting(true);
    try {
      const data = { mealTypes: selectedMeals };
      if (photo) {
        // 上传图片
        const formData = new FormData();
        formData.append('image', {
          uri: photo,
          type: 'image/jpeg',
          name: 'meal.jpg',
        });
        const imgRes = await clockinApi.uploadImage(formData);
        if (imgRes.success) {
          data.imageUrl = imgRes.data.url;
        }
      }
      await clockinApi.createRecord(data);
      Alert.alert('打卡成功', '已记录您的饮食信息');
      setSelectedMeals([]);
      setPhoto(null);
      loadTodaySummary();
    } catch (err) {
      Alert.alert('打卡失败', err.message);
    }
    setSubmitting(false);
  };

  const displayMeals = MEAL_TYPES.slice(0, -1); // 排除拍照选项

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>今日饮食打卡</Text>
          <Text style={styles.subtitle}>今天吃了什么？点击选择</Text>
        </View>

        {/* 图标选择区 */}
        <AppCard>
          <View style={styles.mealGrid}>
            {displayMeals.map((meal) => {
              const isSelected = selectedMeals.includes(meal.key);
              return (
                <TouchableOpacity
                  key={meal.key}
                  style={[styles.mealItem, isSelected && styles.mealSelected]}
                  onPress={() => toggleMeal(meal.key)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mealIcon}>{meal.icon}</Text>
                  <Text style={[styles.mealLabel, isSelected && styles.mealLabelSelected]}>
                    {meal.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* 拍照按钮 */}
            <TouchableOpacity
              style={[styles.mealItem, photo && styles.mealSelected]}
              onPress={handleTakePhoto}
              activeOpacity={0.7}
            >
              <Text style={styles.mealIcon}>📷</Text>
              <Text style={styles.mealLabel}>拍照</Text>
            </TouchableOpacity>
          </View>

          {/* 已选提示 */}
          {selectedMeals.length > 0 && (
            <Text style={styles.selectedHint}>
              已选择：{selectedMeals.map(k => MEAL_TYPES.find(m => m.key === k)?.label).join('、')}
            </Text>
          )}
          {photo && (
            <View style={styles.photoPreview}>
              <Image source={{ uri: photo }} style={styles.thumbnail} />
              <TouchableOpacity onPress={() => setPhoto(null)}>
                <Text style={styles.removePhoto}>删除</Text>
              </TouchableOpacity>
            </View>
          )}
        </AppCard>

        {/* 提交按钮 */}
        <AppButton
          title={submitting ? '提交中...' : '✅ 我吃好了'}
          onPress={handleSubmit}
          loading={submitting}
          disabled={selectedMeals.length === 0}
          style={styles.submitBtn}
        />

        {/* 今日打卡摘要 */}
        {todaySummary && (
          <>
            <Text style={styles.sectionTitle}>今日打卡</Text>
            <AppCard>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>今日积分</Text>
                <Text style={styles.summaryValue}>+{todaySummary.todayPoints || 0}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>打卡次数</Text>
                <Text style={styles.summaryValue}>{todaySummary.recordCount || 0}次</Text>
              </View>
            </AppCard>
          </>
        )}

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 24 },
  header: { padding: 20, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: COLORS.TEXT, marginBottom: 4 },
  subtitle: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY },
  mealGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  mealItem: {
    width: '30%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: COLORS.BG,
  },
  mealSelected: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  mealIcon: { fontSize: 32, marginBottom: 4 },
  mealLabel: { fontSize: FONT.SMALL, color: COLORS.TEXT, fontWeight: '500' },
  mealLabelSelected: { color: COLORS.PRIMARY_DARK, fontWeight: '700' },
  selectedHint: {
    marginTop: 12,
    fontSize: FONT.SMALL,
    color: COLORS.PRIMARY,
    textAlign: 'center',
  },
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  thumbnail: { width: 60, height: 60, borderRadius: 8 },
  removePhoto: { fontSize: FONT.SMALL, color: COLORS.DANGER },
  submitBtn: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: {
    fontSize: FONT.TITLE,
    fontWeight: '600',
    color: COLORS.TEXT,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: { fontSize: FONT.BODY, color: COLORS.TEXT_SECONDARY },
  summaryValue: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT },
});