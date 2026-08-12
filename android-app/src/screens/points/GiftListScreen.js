import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import SafeView from '../../components/SafeView';
import AppButton from '../../components/AppButton';
import { giftApi } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { COLORS, FONT } from '../../utils/constants';

const DEFAULT_IMG = 'https://rry.klai.top/static/images/gifts/default.png';

export default function GiftListScreen() {
  const { user } = useAuth();
  const [gifts, setGifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exchanging, setExchanging] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await giftApi.getList({ page: 1, pageSize: 50 });
        if (res.success) setGifts(res.data?.list || []);
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const handleExchange = async (gift) => {
    if ((user?.points || 0) < gift.points_required) {
      Alert.alert('积分不足', `需要 ${gift.points_required} 积分，当前 ${user?.points || 0} 积分`);
      return;
    }
    Alert.alert(
      '确认兑换',
      `确定要兑换「${gift.name}」吗？\n消耗 ${gift.points_required} 积分`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定兑换',
          onPress: async () => {
            setExchanging(gift.id);
            try {
              const res = await giftApi.exchange(gift.id);
              if (res.success) {
                Alert.alert('兑换成功', `已成功兑换「${gift.name}」`);
              }
            } catch (err) {
              Alert.alert('兑换失败', err.message);
            }
            setExchanging(null);
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <Image
        source={{ uri: item.image || item.image_url || DEFAULT_IMG }}
        style={styles.image}
        defaultSource={require('../../../assets/icon.png')}
      />
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.desc} numberOfLines={2}>{item.description || ''}</Text>
        <View style={styles.bottom}>
          <Text style={styles.price}>
            <Ionicons name="star" size={14} color={COLORS.SECONDARY} /> {item.points_required}积分
          </Text>
          <Text style={styles.stock}>
            {item.stock > 0 ? `库存 ${item.stock}` : '已售罄'}
          </Text>
        </View>
        <AppButton
          title={item.stock > 0 ? '兑换' : '已售罄'}
          onPress={() => handleExchange(item)}
          disabled={item.stock <= 0 || exchanging === item.id}
          loading={exchanging === item.id}
          style={styles.exchangeBtn}
          type={item.stock > 0 ? 'primary' : 'outline'}
        />
      </View>
    </View>
  );

  return (
    <SafeView>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 60 }} />
      ) : (
        <FlatList
          data={gifts}
          renderItem={renderItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <Text style={styles.empty}>暂无礼品</Text>
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
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  image: { width: 120, height: 120, resizeMode: 'cover' },
  info: { flex: 1, padding: 12, justifyContent: 'space-between' },
  name: { fontSize: FONT.BODY, fontWeight: '600', color: COLORS.TEXT },
  desc: { fontSize: 13, color: COLORS.TEXT_SECONDARY, marginTop: 2, lineHeight: 18 },
  bottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  price: { fontSize: 14, color: COLORS.SECONDARY, fontWeight: '600' },
  stock: { fontSize: 13, color: COLORS.TEXT_PLACEHOLDER },
  exchangeBtn: { minHeight: 36, marginTop: 6 },
  empty: { textAlign: 'center', marginTop: 60, fontSize: FONT.BODY, color: COLORS.TEXT_PLACEHOLDER },
});