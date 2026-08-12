import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Image, ActivityIndicator } from 'react-native';
import SafeView from '../../components/SafeView';
import { userApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';
import { formatDate } from '../../utils/format';

const PLACEHOLDER_IMG = 'https://rry.klai.top/static/images/articles/default-cover.jpg';

export default function ArticlesScreen({ navigation }) {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const loadArticles = async (p = 1) => {
    try {
      const res = await userApi.getArticles({ page: p, pageSize: 10 });
      if (res.success) {
        const list = res.data.articles || [];
        setArticles(p === 1 ? list : [...articles, ...list]);
        setHasMore(list.length >= 10);
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { loadArticles(); }, []);

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigation.navigate('ArticleDetail', { articleId: item.id })}
      activeOpacity={0.7}
    >
      <Image
        source={{ uri: item.cover_image || PLACEHOLDER_IMG }}
        style={styles.cover}
        defaultSource={require('../../../assets/icon.png')}
      />
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
        <View style={styles.meta}>
          <Text style={styles.category}>{item.category}</Text>
          <Text style={styles.date}>{formatDate(item.published_at)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeView>
      <FlatList
        data={articles}
        renderItem={renderItem}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        onEndReached={() => { if (hasMore && !loading) { setPage(p => p + 1); loadArticles(page + 1); } }}
        onEndReachedThreshold={0.3}
        ListEmptyComponent={loading ? <ActivityIndicator style={{ marginTop: 40 }} /> :
          <Text style={styles.empty}>暂无资讯</Text>
        }
      />
    </SafeView>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  item: {
    flexDirection: 'row',
    backgroundColor: COLORS.WHITE,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cover: { width: 120, height: 100, resizeMode: 'cover' },
  info: { flex: 1, padding: 12, justifyContent: 'space-between' },
  title: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT, lineHeight: FONT.BODY * 1.5 },
  summary: { fontSize: FONT.SMALL, color: COLORS.TEXT_SECONDARY, marginTop: 4, lineHeight: FONT.SMALL * 1.6 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  category: { fontSize: 13, color: COLORS.PRIMARY, fontWeight: '500' },
  date: { fontSize: 13, color: COLORS.TEXT_PLACEHOLDER },
  empty: { textAlign: 'center', marginTop: 60, fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER },
});