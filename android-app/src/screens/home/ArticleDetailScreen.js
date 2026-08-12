import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, ActivityIndicator } from 'react-native';
import SafeView from '../../components/SafeView';
import { userApi } from '../../api';
import { COLORS, FONT } from '../../utils/constants';
import { formatDateTime } from '../../utils/format';

export default function ArticleDetailScreen({ route }) {
  const { articleId } = route.params;
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await userApi.getArticleDetail(articleId);
        if (res.success) setArticle(res.data.article);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, [articleId]);

  if (loading) return <SafeView><ActivityIndicator style={{ marginTop: 60 }} /></SafeView>;
  if (!article) return <SafeView><Text style={styles.error}>资讯不存在</Text></SafeView>;

  return (
    <SafeView>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{article.title}</Text>
        <View style={styles.meta}>
          <Text style={styles.category}>{article.category}</Text>
          <Text style={styles.date}>{formatDateTime(article.published_at)}</Text>
          <Text style={styles.views}>👁 {article.view_count || 0}次阅读</Text>
        </View>
        <View style={styles.divider} />
        <Text style={styles.content}>{article.content || '暂无内容'}</Text>
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20 },
  title: { fontSize: 22, fontWeight: '700', color: COLORS.TEXT, lineHeight: 32, marginBottom: 12 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  category: { fontSize: 14, color: COLORS.PRIMARY, fontWeight: '500' },
  date: { fontSize: 14, color: COLORS.TEXT_PLACEHOLDER },
  views: { fontSize: 14, color: COLORS.TEXT_PLACEHOLDER },
  divider: { height: 1, backgroundColor: COLORS.BORDER, marginBottom: 20 },
  content: { fontSize: FONT.BODY, color: COLORS.TEXT, lineHeight: FONT.BODY * 1.8 },
  error: { textAlign: 'center', marginTop: 60, fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER },
});