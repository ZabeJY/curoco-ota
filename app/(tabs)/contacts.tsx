/**
 * Curoco — Contacts (Redesigned)
 */

import React, { useCallback, useState, useRef } from 'react';
import {
  View, FlatList, TouchableOpacity, Text, StyleSheet, Alert,
  ActivityIndicator, Platform, Modal, Animated,
} from 'react-native';
import TiltCard from '../../src/components/common/TiltCard';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Avatar from '../../src/components/common/Avatar';
import { useCompanionStore } from '../../src/store/companionStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import type { Companion } from '../../src/types/models';

export default function ContactsPage() {
  const router = useRouter();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { companions, loadCompanions, deleteCompanion } = useCompanionStore();
  const [navId, setNavId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuCompanion, setMenuCompanion] = useState<Companion | null>(null);
  const menuFade = useRef(new Animated.Value(0)).current;
  const menuSlide = useRef(new Animated.Value(40)).current;

  // Tab bar: height 64 + marginBottom 10 + safe area bottom
  const TAB_BAR_TOTAL = 64 + 10 + insets.bottom;

  useFocusEffect(useCallback(() => { loadCompanions(); }, []));

  function showMenu(c: Companion) {
    setMenuCompanion(c);
    Animated.parallel([
      Animated.timing(menuFade, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.spring(menuSlide, { toValue: 0, friction: 8, tension: 80, useNativeDriver: true }),
    ]).start();
  }

  function hideMenu() {
    Animated.parallel([
      Animated.timing(menuFade, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(menuSlide, { toValue: 40, duration: 150, useNativeDriver: true }),
    ]).start(() => setMenuCompanion(null));
  }

  async function handlePress(c: Companion) {
    if (navId) return;
    setNavId(c.id);
    try {
      let conv = await ConversationRepository.getByCompanionId(c.id);
      if (!conv) conv = await ConversationRepository.create(c.id);
      router.push({ pathname: '/chat/[id]', params: { id: conv.id, companionId: c.id, name: c.name } });
    } catch { Alert.alert('错误', '无法打开对话'); }
    finally { setTimeout(() => setNavId(null), 500); }
  }

  function handleMenuAction(action: string) {
    if (!menuCompanion) return;
    const c = menuCompanion;
    hideMenu();
    setTimeout(() => {
      switch (action) {
        case 'chat': handlePress(c); break;
        case 'settings': router.push(`/companion/${c.id}/settings`); break;
        case 'edit': router.push(`/companion/${c.id}/edit`); break;
        case 'persona': router.push(`/companion/${c.id}/persona`); break;
        case 'detail': router.push(`/companion/${c.id}`); break;
        case 'delete':
          Alert.alert('确认删除', `确定要删除 ${c.name} 吗？`, [
            { text: '取消', style: 'cancel' },
            { text: '删除', style: 'destructive', onPress: async () => { await deleteCompanion(c.id); } },
          ]);
          break;
      }
    }, 200);
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bgPrimary }]}>
      <FlatList
        data={companions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TiltCard containerStyle={{ marginBottom: 2 }}>
            <TouchableOpacity style={styles.item} onPress={() => handlePress(item)} onLongPress={() => showMenu(item)} activeOpacity={0.6}>
              <Avatar uri={item.avatarUri} name={item.name} size="md" />
              <View style={styles.itemBody}>
                <Text style={[styles.name, { color: theme.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.sub, { color: theme.textSecondary }]}>{item.relationship} · {item.age}岁</Text>
              </View>
              {navId === item.id ? <ActivityIndicator size="small" color={theme.primary} /> : <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />}
            </TouchableOpacity>
          </TiltCard>
        )}
        refreshing={refreshing}
        onRefresh={async () => { setRefreshing(true); await loadCompanions(); setRefreshing(false); }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.bgTertiary }]}><Ionicons name="people-outline" size={48} color={theme.textTertiary} /></View>
            <Text style={[styles.emptyTitle, { color: theme.textPrimary }]}>还没有角色</Text>
            <Text style={[styles.emptySub, { color: theme.textSecondary }]}>点击右下角 + 创建一个</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
      <TouchableOpacity style={[styles.fabImport, { bottom: TAB_BAR_TOTAL + 152 }]} onPress={() => router.push('/chat/create-group')} activeOpacity={0.8}>
        <Ionicons name="people" size={22} color="#FF9500" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.fabImport, { bottom: TAB_BAR_TOTAL + 84 }]} onPress={async () => {
        try {
          const { CharacterCardService } = require('../../src/core/CharacterCardService');
          const result = await CharacterCardService.importCard();
          if (result.success) {
            Alert.alert('导入成功', `${result.companionName} 已成功导入！`);
            await loadCompanions();
          } else {
            Alert.alert('导入失败', result.error || '请检查文件格式');
          }
        } catch (e: any) {
          Alert.alert('导入失败', e?.message || '请重试');
        }
      }} activeOpacity={0.8}>
        <Ionicons name="download-outline" size={22} color="#6C63FF" />
      </TouchableOpacity>

      <TouchableOpacity style={[styles.fab, { bottom: TAB_BAR_TOTAL + 16 }]} onPress={() => router.push('/companion/create')} activeOpacity={0.8}>
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Long-press action menu */}
      <Modal visible={!!menuCompanion} transparent animationType="none" onRequestClose={hideMenu}>
        <Animated.View style={[styles.menuOverlay, { opacity: menuFade }]}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={hideMenu}>
            <Animated.View style={[styles.menuBox, { transform: [{ translateY: menuSlide }] }]}>
              <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
              <View style={styles.menuContent}>
                <Text style={styles.menuTitle}>{menuCompanion?.name}</Text>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('chat')} activeOpacity={0.6}>
                  <Ionicons name="chatbubble-outline" size={20} color="#6C63FF" />
                  <Text style={styles.menuItemText}>开始聊天</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('settings')} activeOpacity={0.6}>
                  <Ionicons name="settings-outline" size={20} color="#6C63FF" />
                  <Text style={styles.menuItemText}>角色设置</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('edit')} activeOpacity={0.6}>
                  <Ionicons name="create-outline" size={20} color="#6C63FF" />
                  <Text style={styles.menuItemText}>编辑全部</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('persona')} activeOpacity={0.6}>
                  <Ionicons name="person-outline" size={20} color="#6C63FF" />
                  <Text style={styles.menuItemText}>编辑人设</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('detail')} activeOpacity={0.6}>
                  <Ionicons name="information-circle-outline" size={20} color="#6C63FF" />
                  <Text style={styles.menuItemText}>查看详情</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => handleMenuAction('delete')} activeOpacity={0.6}>
                  <Ionicons name="trash-outline" size={20} color="#FF4757" />
                  <Text style={[styles.menuItemText, { color: '#FF4757' }]}>删除角色</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  itemBody: { flex: 1, marginLeft: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F8', paddingBottom: 13 },
  name: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  sub: { fontSize: 13, color: '#6B6B8D', marginTop: 3 },
  empty: { alignItems: 'center', padding: 60 },
  emptyIcon: { width: 80, height: 80, borderRadius: 24, backgroundColor: '#F0EFF5', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: '#1A1A2E', marginBottom: 4 },
  emptySub: { fontSize: 13, color: '#6B6B8D' },
  fab: {
    position: 'absolute', right: 20, width: 56, height: 56, borderRadius: 18,
    backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8,
  },
  fabImport: {
    position: 'absolute', right: 24, width: 44, height: 44, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
  },
  // Menu modal
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  menuBox: {
    width: 240, borderRadius: 20, overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.92)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12,
  },
  menuContent: { padding: 8 },
  menuTitle: { fontSize: 15, fontWeight: '600', color: '#1A1A2E', textAlign: 'center', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E8EA' },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16 },
  menuItemText: { fontSize: 15, color: '#1A1A2E' },
  menuDivider: { height: StyleSheet.hairlineWidth, backgroundColor: '#E8E8EA', marginVertical: 4 },
});
