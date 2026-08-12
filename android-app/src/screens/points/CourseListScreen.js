import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import { pointsApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';

export default function CourseListScreen({ navigation }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await pointsApi.getCourses({ page: 1, pageSize: 50 });
        if (res.success) setCourses(res.data?.list || []);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('CourseDetail', { courseId: item.id, course: item })}
      activeOpacity={0.7}
    >
      <View style={[styles.iconWrap, { backgroundColor: item.category === 'nutrition' ? '#E8F5E9' : '#E3F2FD' }]}>
        <Ionicons
          name={item.category === 'nutrition' ? 'nutrition' : 'fitness'}
          size={28}
          color={item.category === 'nutrition' ? COLORS.PRIMARY : '#2196F3'}
        />
      </View>
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.desc} numberOfLines={2}>{item.description}</Text>
        <View style={styles.meta}>
          <Text style={styles.points}>+{item.points || 0}积分</Text>
          <Text style={styles.duration}>{item.duration || '未知'}分钟</Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.TEXT_PLACEHOLDER} />
    </TouchableOpacity>
  );

  return (
    <SafeView>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={courses}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>暂无课程</Text>
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
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  iconWrap: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  info: { flex: 1 },
  title: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT, marginBottom: 4 },
  desc: { fontSize: 14, color: COLORS.TEXT_SECONDARY, lineHeight: 20, marginBottom: 6 },
  meta: { flexDirection: 'row', gap: 16 },
  points: { fontSize: 13, color: COLORS.SECONDARY, fontWeight: '600' },
  duration: { fontSize: 13, color: COLORS.TEXT_PLACEHOLDER },
  empty: { textAlign: 'center', marginTop: 60, fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER },
});