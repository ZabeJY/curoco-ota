/**
 * Curoco — Donation/Tip Page
 * ProductHighlightCard style: rounded card, floating icon, clean layout
 * QR codes: Alipay QR code in modal
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import GlassModal from '../../src/components/common/GlassModal';

const TIER_DATA = [
  { id: 'water', price: 2, icon: '💧', name: '矿泉水', desc: '续杯凉水，接着敲代码' },
  { id: 'cola', price: 5, icon: '🥤', name: '冰可乐', desc: '冰爽一下，改bug更有劲' },
  { id: 'noodle', price: 8, icon: '🍜', name: '泡面', desc: '深夜口粮，熬完这个版本' },
  { id: 'deluxe', price: 12, icon: '🍝', name: '加肠泡面', desc: '豪华加餐，干劲直接拉满' },
  { id: 'milktea', price: 16, icon: '🧋', name: '奶茶', desc: '回血充能，安排新功能' },
  { id: 'coffee', price: 28, icon: '☕', name: '美式咖啡', desc: '通宵迭代，加急更版' },
  { id: 'meal', price: 50, icon: '🍱', name: '快餐', desc: '好好吃饭，长期维护' },
];

const QR_IMAGES: Record<string, any> = {
  water: require('../../assets/donation/alipay_2.png'),
  cola: require('../../assets/donation/alipay_5.png'),
  noodle: require('../../assets/donation/alipay_8.png'),
  deluxe: require('../../assets/donation/alipay_12.png'),
  milktea: require('../../assets/donation/alipay_16.png'),
  coffee: require('../../assets/donation/alipay_28.png'),
  meal: require('../../assets/donation/alipay_50.png'),
};

export default function DonatePage() {
  const { theme } = useTheme();
  const [selectedTier, setSelectedTier] = useState<typeof TIER_DATA[0] | null>(null);
  const [showQR, setShowQR] = useState(false);

  function handleTierPress(tier: typeof TIER_DATA[0]) {
    setSelectedTier(tier);
    setShowQR(true);
  }

  const qrImage = selectedTier ? QR_IMAGES[selectedTier.id] : null;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bgPrimary }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.headerSection}>
        <Text style={[styles.mainTitle, { color: theme.textPrimary }]}>支持一下开发者</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          本软件全部功能永久免费开放，{'\n'}打赏为用户自愿赠与，不解锁任何权益、不提供额外服务
        </Text>
      </View>

      {/* Tier Grid */}
      <View style={styles.tierGrid}>
        {TIER_DATA.map((tier) => (
          <TouchableOpacity
            key={tier.id}
            style={[styles.tierCard, { backgroundColor: theme.bgSecondary }]}
            onPress={() => handleTierPress(tier)}
            activeOpacity={0.7}
          >
            {/* Diagonal texture overlay */}
            <View style={styles.cardTexture} />

            {/* Top-left: category icon + name */}
            <View style={styles.cardTop}>
              <Text style={styles.cardIcon}>{tier.icon}</Text>
              <Text style={[styles.cardName, { color: theme.textSecondary }]} numberOfLines={1}>{tier.name}</Text>
            </View>

            {/* Center: price */}
            <Text style={[styles.cardPrice, { color: theme.textPrimary }]}>¥{tier.price}</Text>

            {/* Bottom-right: floating emoji */}
            <Text style={styles.cardFloatingIcon}>{tier.icon}</Text>

            {/* Bottom: description */}
            <Text style={[styles.cardDesc, { color: theme.textTertiary }]} numberOfLines={2}>{tier.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimerSection}>
        <Text style={[styles.disclaimerText, { color: theme.textTertiary }]}>
          本打赏为用户自愿支持行为，软件所有核心功能无任何付费限制
        </Text>
        <Text style={[styles.disclaimerText, { color: theme.textTertiary }]}>
          打赏款项仅用于覆盖开发、更新维护的基础成本，不构成服务承诺与质保约定
        </Text>
        <Text style={[styles.disclaimerText, { color: theme.textTertiary }]}>
          本软件仅为第三方AI大模型API接入客户端，不内置AI服务，生成内容相关责任与开发者无关
        </Text>
      </View>

      {/* QR Code Modal */}
      <GlassModal visible={showQR} onClose={() => setShowQR(false)}>
        <View style={{ padding: 8 }}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalIcon}>{selectedTier?.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.modalName, { color: theme.textPrimary }]}>{selectedTier?.name}</Text>
              <Text style={[styles.modalPrice, { color: theme.primary }]}>¥{selectedTier?.price}</Text>
            </View>
          </View>

          {/* QR Code */}
          {qrImage && (
            <View style={[styles.qrWrap, { backgroundColor: theme.bgTertiary }]}>
              <Image source={qrImage} style={styles.qrImage} resizeMode="contain" />
            </View>
          )}
        </View>
      </GlassModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  // Header
  headerSection: { alignItems: 'center', paddingVertical: 24 },
  mainTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },

  // Tier Grid
  tierGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    justifyContent: 'space-between',
  },
  tierCard: {
    width: '30%', borderRadius: 16, padding: 14,
    minHeight: 140, justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
    overflow: 'hidden',
  },
  cardTexture: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.03,
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.04)',
    borderRadius: 16,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardIcon: { fontSize: 16 },
  cardName: { fontSize: 11, fontWeight: '500', flex: 1 },
  cardPrice: { fontSize: 24, fontWeight: '800', marginTop: 8 },
  cardFloatingIcon: {
    position: 'absolute', right: -4, bottom: 28,
    fontSize: 48, opacity: 0.12,
  },
  cardDesc: { fontSize: 10, lineHeight: 14, marginTop: 4 },

  // Disclaimer
  disclaimerSection: {
    marginTop: 28, gap: 8,
    paddingHorizontal: 4,
  },
  disclaimerText: { fontSize: 11, lineHeight: 16 },

  // Modal
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', width: '100%', marginBottom: 20,
  },
  modalIcon: { fontSize: 32, marginRight: 12 },
  modalName: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  modalPrice: { fontSize: 22, fontWeight: '800' },

  // QR Code
  qrWrap: {
    width: 200, height: 200, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', marginBottom: 16,
  },
  qrImage: { width: 180, height: 180 },
});
