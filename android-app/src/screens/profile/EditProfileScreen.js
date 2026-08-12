import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, StyleSheet, Alert } from 'react-native';
import SafeView from '../../components/SafeView';
import AppButton from '../../components/AppButton';
import { userApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT } from '../../utils/constants';

export default function EditProfileScreen({ navigation }) {
  const { user, updateUser } = useAuth();
  const [nickName, setNickName] = useState(user?.nickName || '');
  const [gender, setGender] = useState(user?.gender || 'unknown');
  const [age, setAge] = useState(user?.age ? String(user.age) : '');
  const [height, setHeight] = useState(user?.height ? String(user.height) : '');
  const [weight, setWeight] = useState(user?.weight ? String(user.weight) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = {};
      if (nickName) data.nickName = nickName;
      if (gender !== 'unknown') data.gender = gender;
      if (age) data.age = parseInt(age);
      if (height) data.height = parseFloat(height);
      if (weight) data.weight = parseFloat(weight);

      const res = await userApi.updateInfo(data);
      if (res.success) {
        updateUser(res.data);
        Alert.alert('保存成功', '个人资料已更新');
        navigation.goBack();
      }
    } catch (err) {
      Alert.alert('保存失败', err.message);
    }
    setSaving(false);
  };

  const GENDERS = [
    { key: 'male', label: '男' },
    { key: 'female', label: '女' },
    { key: 'unknown', label: '保密' },
  ];

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.field}>
          <Text style={styles.label}>昵称</Text>
          <TextInput
            style={styles.input}
            value={nickName}
            onChangeText={setNickName}
            placeholder="请输入昵称"
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>性别</Text>
          <View style={styles.genderRow}>
            {GENDERS.map(g => (
              <AppButton
                key={g.key}
                title={g.label}
                type={gender === g.key ? 'primary' : 'outline'}
                onPress={() => setGender(g.key)}
                style={styles.genderBtn}
              />
            ))}
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>年龄</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            keyboardType="number-pad"
            placeholder="请输入年龄"
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>身高(cm)</Text>
          <TextInput
            style={styles.input}
            value={height}
            onChangeText={setHeight}
            keyboardType="decimal-pad"
            placeholder="请输入身高"
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>体重(kg)</Text>
          <TextInput
            style={styles.input}
            value={weight}
            onChangeText={setWeight}
            keyboardType="decimal-pad"
            placeholder="请输入体重"
            placeholderTextColor={COLORS.TEXT_PLACEHOLDER}
          />
        </View>

        <AppButton
          title="保存"
          onPress={handleSave}
          loading={saving}
          style={styles.saveBtn}
        />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  field: { marginBottom: 20 },
  label: { fontSize: FONT.BODY, fontWeight: '500', color: COLORS.TEXT, marginBottom: 8 },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: FONT.BODY,
    color: COLORS.TEXT,
    backgroundColor: COLORS.WHITE,
  },
  genderRow: { flexDirection: 'row', gap: 12 },
  genderBtn: { flex: 1, minHeight: 44 },
  saveBtn: { marginTop: 16 },
});