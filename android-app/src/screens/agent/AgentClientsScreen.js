import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import { authApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';
import { formatDate } from '../../utils/format';

export default function AgentClientsScreen() {
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authApi.getMyReferrals(1, 100);
        if (res.success) setReferrals(res.data.referrals || []);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View style={styles.avatar}>
        <Ionicons name="person" size={24} color={COLORS.TEXT_SECONDARY} />
      </View>
      <View style={styles.info}>
        <Text style={styles.name}>{item.nickName || '用户'}</Text>
        <Text style={styles.date}>注册时间：{formatDate(item.createdAt)}</Text>
      </View>
      <View style={[styles.status, item.questionnaireCompleted && styles.statusDone]}>
        <Text style={[styles.statusText, item.questionnaireCompleted && { color: COLORS.WHITE }]}>
          {item.questionnaireCompleted ? '已评估' : '未评估'}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeView>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={referrals}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>暂无名下客户</Text>
          }
        />
      )}
    </SafeView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.BG,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  info: { flex: 1 },
  name: { fontSize: FONT.BODY, fontWeight: '500', color: COLORS.TEXT },
  date: { fontSize: 13, color: COLORS.TEXT_PLACEHOLDER, marginTop: 2 },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FFF3E0' },
  statusDone: { backgroundColor: COLORS.PRIMARY },
  statusText: { fontSize: 13, color: COLORS.WARNING, fontWeight: '500' },
  empty: { textAlign: 'center', marginTop: 60, fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER },
});