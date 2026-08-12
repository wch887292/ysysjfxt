import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Switch, Alert, TouchableOpacity } from 'react-native';
import SafeView from '../../components/SafeView';
import { userApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

const PRIVACY_ITEMS = [
  { key: 'showProfile', label: '展示个人资料', desc: '允许代理商/服务商查看您的个人资料' },
  { key: 'showPhone', label: '展示手机号', desc: '允许代理商/服务商查看您的手机号' },
  { key: 'showHealthData', label: '展示健康数据', desc: '允许查看您的身高体重等健康数据' },
  { key: 'showReports', label: '展示健康报告', desc: '允许代理商/服务商查看您的健康报告' },
];

export default function PrivacySettingsScreen() {
  const [settings, setSettings] = useState({});

  useEffect(() => {
    (async () => {
      try {
        const res = await userApi.getPrivacyVisibility();
        if (res.success) setSettings(res.data.visibilitySettings || {});
      } catch (e) { /* ignore */ }
    })();
  }, []);

  const toggleSetting = async (key) => {
    const newVal = !settings[key];
    const next = { ...settings, [key]: newVal };
    setSettings(next);
    try {
      await userApi.updatePrivacyVisibility({ [key]: newVal });
    } catch (err) {
      // 回滚
      setSettings(settings);
      Alert.alert('保存失败', err.message);
    }
  };

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.desc}>设置您的个人数据可见范围，保护隐私安全</Text>
        {PRIVACY_ITEMS.map((item) => (
          <View key={item.key} style={styles.item}>
            <View style={styles.info}>
              <Text style={styles.label}>{item.label}</Text>
              <Text style={styles.detail}>{item.desc}</Text>
            </View>
            <Switch
              value={settings[item.key] ?? true}
              onValueChange={() => toggleSetting(item.key)}
              trackColor={{ false: COLORS.DISABLED, true: COLORS.PRIMARY_LIGHT }}
              thumbColor={settings[item.key] ? COLORS.PRIMARY : '#f4f3f4'}
            />
          </View>
        ))}
        <View style={styles.actions}>
          <Text style={styles.actionTitle}>数据管理</Text>
          <TouchableOpacity onPress={async () => {
            try {
              const res = await userApi.exportData();
              if (res.success) Alert.alert('导出成功', '数据导出请求已提交，请等待处理');
            } catch (err) {
              Alert.alert('导出失败', err.message);
            }
          }}>
            <Text style={styles.actionLink}>导出个人数据</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => {
            Alert.alert(
              '确认删除账号',
              '删除账号后所有数据将被清除，此操作不可恢复。确定要申请删除吗？',
              [
                { text: '取消', style: 'cancel' },
                {
                  text: '申请删除',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const res = await userApi.requestDeletion('用户主动申请');
                      if (res.success) Alert.alert('申请已提交', '账号删除申请已提交，请等待处理');
                    } catch (err) {
                      Alert.alert('申请失败', err.message);
                    }
                  },
                },
              ]
            );
          }}>
            <Text style={[styles.actionLink, { color: COLORS.DANGER }]}>申请删除账号</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  desc: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginBottom: 20, lineHeight: FONT.SMALL * 1.8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  info: { flex: 1, marginRight: 12 },
  label: { fontSize: FONT.BODY, fontWeight: '500', color: COLORS.TEXT, marginBottom: 4 },
  detail: { fontSize: 13, color: COLORS.TEXT_SECONDARY, lineHeight: 18 },
  actions: { marginTop: 20 },
  actionTitle: { fontSize: FONT.TITLE, fontWeight: '600', color: COLORS.TEXT, marginBottom: 12 },
  actionLink: { fontSize: FONT.BODY, color: COLORS.PRIMARY, marginBottom: 12, paddingVertical: 8 },
});