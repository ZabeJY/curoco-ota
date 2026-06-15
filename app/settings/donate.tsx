/**
 * Curoco — Donation/Tip Page
 * Voluntary support page with cartoon-style design
 * Clean, fresh, no manipulative tactics
 */

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Image, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import TiltCard from '../../src/components/common/TiltCard';
import { useSettingsStore } from '../../src/store/settingsStore';

const TIER_DATA = [
  { id: 'water', price: 2, icon: '💧', name: '瓶装矿泉水', desc: '续杯凉水，接着敲代码' },
  { id: 'cola', price: 5, icon: '🥤', name: '罐装冰可乐', desc: '冰爽一下，改bug更有劲' },
  { id: 'noodle', price: 8, icon: '🍜', name: '桶装泡面', desc: '深夜口粮，熬完这个版本' },
  { id: 'deluxe', price: 12, icon: '🍝', name: '加肠泡面', desc: '豪华加餐，干劲直接拉满' },
  { id: 'milktea', price: 16, icon: '🧋', name: '杯装奶茶', desc: '回血充能，安排新功能' },
  { id: 'coffee', price: 28, icon: '☕', name: '美式咖啡', desc: '通宵迭代，加急更版' },
  { id: 'meal', price: 50, icon: '🍱', name: '单人快餐', desc: '好好吃饭，长期维护' },
];

export default function DonatePage() {
  const { theme } = useTheme();
  const { settings } = useSettingsStore();
  const [selectedTier, setSelectedTier] = useState<typeof TIER_DATA[0] | null>(null);
  const [showQR, setShowQR] = useState(false);

  function handleTierPress(tier: typeof TIER_DATA[0]) {
    setSelectedTier(tier);
    setShowQR(true);
  }

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
          <TiltCard key={tier.id} containerStyle={{ marginBottom: 0 }}>
            <TouchableOpacity
              style={[styles.tierCard, { backgroundColor: theme.bgSecondary, borderColor: theme.border }]}
              onPress={() => handleTierPress(tier)}
              activeOpacity={0.7}
            >
              <Text style={styles.tierIcon}>{tier.icon}</Text>
              <Text style={[styles.tierPrice, { color: theme.primary }]}>¥{tier.price}</Text>
              <Text style={[styles.tierName, { color: theme.textPrimary }]}>{tier.name}</Text>
              <Text style={[styles.tierDesc, { color: theme.textSecondary }]}>{tier.desc}</Text>
            </TouchableOpacity>
          </TiltCard>
        ))}
      </View>

      {/* Disclaimer */}
      <View style={[styles.disclaimerCard, { backgroundColor: theme.bgSecondary }]}>
        <Ionicons name="information-circle-outline" size={16} color={theme.textTertiary} />
        <View style={styles.disclaimerContent}>
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
      </View>

      {/* QR Code Modal */}
      <Modal visible={showQR} transparent animationType="fade" onRequestClose={() => setShowQR(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowQR(false)}>
          <View style={[styles.modalContent, { backgroundColor: theme.bgSecondary }]}>
            <Text style={[styles.modalTitle, { color: theme.textPrimary }]}>
              {selectedTier?.icon} {selectedTier?.name}
            </Text>
            <Text style={[styles.modalPrice, { color: theme.primary }]}>¥{selectedTier?.price}</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              {selectedTier?.desc}
            </Text>
            <View style={[styles.qrPlaceholder, { backgroundColor: theme.bgTertiary }]}>
              <Ionicons name="qr-code-outline" size={80} color={theme.textTertiary} />
              <Text style={[styles.qrHint, { color: theme.textTertiary }]}>
                请将收款码图片放置于此
              </Text>
              <Text style={[styles.qrHint, { color: theme.textTertiary, fontSize: 11 }]}>
                文件路径：assets/donation_qr.png
              </Text>
            </View>
            <TouchableOpacity style={[styles.modalCloseBtn, { backgroundColor: theme.primary }]} onPress={() => setShowQR(false)}>
              <Text style={styles.modalCloseText}>关闭</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  headerSection: { alignItems: 'center', paddingVertical: 24 },
  mainTitle: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  subtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
  tierGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
  },
  tierCard: {
    width: '30%', borderRadius: 16, padding: 14, alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  tierIcon: { fontSize: 28, marginBottom: 6 },
  tierPrice: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  tierName: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  tierDesc: { fontSize: 10, textAlign: 'center', lineHeight: 14 },
  disclaimerCard: {
    flexDirection: 'row', gap: 10, padding: 16, borderRadius: 14, marginTop: 24,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)',
  },
  disclaimerContent: { flex: 1, gap: 6 },
  disclaimerText: { fontSize: 11, lineHeight: 16 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center',
  },
  modalContent: {
    width: '85%', borderRadius: 20, padding: 24, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 12,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  modalPrice: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  modalDesc: { fontSize: 13, marginBottom: 20 },
  qrPlaceholder: {
    width: 200, height: 200, borderRadius: 16, alignItems: 'center',
    justifyContent: 'center', marginBottom: 20,
  },
  qrHint: { fontSize: 12, marginTop: 8 },
  modalCloseBtn: {
    paddingHorizontal: 32, paddingVertical: 12, borderRadius: 20,
  },
  modalCloseText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
