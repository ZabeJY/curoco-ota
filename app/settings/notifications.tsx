/**
 * Curoco — Notification & Interaction Settings
 * System notifications, voice call config, do-not-disturb
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet, Switch, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import { useSettingsStore } from '../../src/store/settingsStore';
import { SettingsRepository } from '../../src/db/repositories/SettingsRepository';
import { initNotificationChannels, requestNotificationPermission, sendNotification } from '../../src/core/NotificationManager';

type CallFrequency = 'low' | 'medium' | 'high';

export default function NotificationSettingsPage() {
  const { theme } = useTheme();

  const [chatPush, setChatPush] = useState(true);
  const [dynamicReminder, setDynamicReminder] = useState(true);
  const [allowAICall, setAllowAICall] = useState(false);
  const [callFrequency, setCallFrequency] = useState<CallFrequency>('medium');
  const [dndStart, setDndStart] = useState('23:00');
  const [dndEnd, setDndEnd] = useState('08:00');
  const [notifPermission, setNotifPermission] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPermission();
  }, []);

  async function loadSettings() {
    try {
      const cp = await SettingsRepository.getSetting('notif_chat_push');
      const dr = await SettingsRepository.getSetting('notif_dynamic_reminder');
      const ac = await SettingsRepository.getSetting('notif_ai_call');
      const cf = await SettingsRepository.getSetting('notif_call_frequency');
      const ds = await SettingsRepository.getSetting('notif_dnd_start');
      const de = await SettingsRepository.getSetting('notif_dnd_end');

      if (cp !== null) setChatPush(cp === 'true');
      if (dr !== null) setDynamicReminder(dr === 'true');
      if (ac !== null) setAllowAICall(ac === 'true');
      if (cf) setCallFrequency(cf as CallFrequency);
      if (ds) setDndStart(ds);
      if (de) setDndEnd(de);
    } catch {}
  }

  async function checkPermission() {
    try {
      const Notifications = require('expo-notifications');
      const { status } = await Notifications.getPermissionsAsync();
      setNotifPermission(status === 'granted');
    } catch {
      setNotifPermission(false);
    }
  }

  async function save(key: string, value: string) {
    await SettingsRepository.setSetting(key, value);
  }

  async function handleRequestPermission() {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted);
    if (granted) {
      await initNotificationChannels();
      Alert.alert('已开启通知', '现在角色可以通过系统通知联系你了');
    } else {
      Alert.alert('通知权限未开启', '请在手机设置中允许 Curoco 发送通知');
    }
  }

  async function handleTestNotification() {
    if (!notifPermission) {
      Alert.alert('提示', '请先开启通知权限');
      return;
    }
    try {
      await sendNotification({
        type: 'system',
        message: '这是一条测试通知，如果你能看到说明通知功能正常工作！',
      });
      Alert.alert('已发送', '测试通知已发送，请查看通知栏');
    } catch (e: any) {
      Alert.alert('发送失败', e?.message || '未知错误');
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bgPrimary }]} contentContainerStyle={styles.content}>

      {/* Permission status */}
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.permRow}>
          <Ionicons
            name={notifPermission ? 'notifications' : 'notifications-off'}
            size={22}
            color={notifPermission ? '#2ED573' : '#FF4757'}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.permTitle, { color: theme.textPrimary }]}>
              {notifPermission ? '通知权限已开启' : '通知权限未开启'}
            </Text>
            <Text style={[styles.permDesc, { color: theme.textTertiary }]}>
              {notifPermission ? '角色可以通过系统通知联系你' : '需要开启通知才能收到 AI 的消息推送'}
            </Text>
          </View>
          {!notifPermission && (
            <TouchableOpacity style={styles.permBtn} onPress={handleRequestPermission}>
              <Text style={styles.permBtnText}>开启</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Test notification */}
      {notifPermission && (
        <TouchableOpacity
          style={[styles.testBtn, { backgroundColor: theme.bgSecondary }]}
          onPress={handleTestNotification}
          activeOpacity={0.7}
        >
          <Ionicons name="send-outline" size={18} color="#6C63FF" />
          <Text style={[styles.testBtnText, { color: theme.textPrimary }]}>发送测试通知</Text>
        </TouchableOpacity>
      )}

      {/* Notification toggles */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>互动与系统通知</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        {/* Chat push */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLeft}>
            <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>离线消息推送</Text>
            <Text style={[styles.toggleDesc, { color: theme.textTertiary }]}>
              开启后，当 AI 想念你或回复你时，会在手机通知栏弹出贴心提醒。
            </Text>
          </View>
          <Switch
            value={chatPush}
            onValueChange={(v) => { setChatPush(v); save('notif_chat_push', String(v)); }}
          />
        </View>

        {/* Dynamic reminder */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleLeft}>
            <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>动态空间同步</Text>
            <Text style={[styles.toggleDesc, { color: theme.textTertiary }]}>
              当 AI 偷偷更新了朋友圈或固化了关于你的记忆时，及时通知你。
            </Text>
          </View>
          <Switch
            value={dynamicReminder}
            onValueChange={(v) => { setDynamicReminder(v); save('notif_dynamic_reminder', String(v)); }}
          />
        </View>

        {/* AI call */}
        <View style={[styles.toggleRow, { borderBottomWidth: 0 }]}>
          <View style={styles.toggleLeft}>
            <Text style={[styles.toggleTitle, { color: theme.textPrimary }]}>允许 AI 主动拨打语音电话</Text>
            <Text style={[styles.toggleDesc, { color: theme.textTertiary }]}>
              【核心功能】允许 AI 在清晨、深夜或特定纪念日，像真实伴侣一样向你发起实时语音呼叫。
            </Text>
          </View>
          <Switch
            value={allowAICall}
            onValueChange={(v) => { setAllowAICall(v); save('notif_ai_call', String(v)); }}
          />
        </View>
      </View>

      {/* Call frequency (only when AI call enabled) */}
      {allowAICall && (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>呼叫频率</Text>
          <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
            <View style={styles.freqRow}>
              {([
                { key: 'low' as const, label: '克制', desc: '偶尔打来' },
                { key: 'medium' as const, label: '适中', desc: '每天1-2次' },
                { key: 'high' as const, label: '黏人', desc: '经常打来' },
              ]).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[styles.freqBtn, callFrequency === opt.key && styles.freqBtnActive]}
                  onPress={() => { setCallFrequency(opt.key); save('notif_call_frequency', opt.key); }}
                >
                  <Ionicons
                    name={callFrequency === opt.key ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={callFrequency === opt.key ? '#6C63FF' : '#B0B0B0'}
                  />
                  <Text style={[styles.freqLabel, callFrequency === opt.key && { color: '#6C63FF', fontWeight: '600' }]}>
                    {opt.label}
                  </Text>
                  <Text style={[styles.freqDesc, { color: theme.textTertiary }]}>{opt.desc}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>勿扰时段</Text>
          <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
            <View style={styles.dndRow}>
              <Ionicons name="moon-outline" size={18} color={theme.textSecondary} />
              <Text style={[styles.dndLabel, { color: theme.textPrimary }]}>此期间绝对不拨打电话</Text>
            </View>
            <View style={styles.timeRow}>
              <View style={styles.timeBox}>
                <Text style={[styles.timeText, { color: theme.textPrimary }]}>{dndStart}</Text>
              </View>
              <Text style={[styles.timeSep, { color: theme.textTertiary }]}>至</Text>
              <View style={styles.timeBox}>
                <Text style={[styles.timeText, { color: theme.textPrimary }]}>{dndEnd}</Text>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 20, marginBottom: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  // Permission
  permRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  permTitle: { fontSize: 15, fontWeight: '600' },
  permDesc: { fontSize: 12, marginTop: 2 },
  permBtn: { backgroundColor: '#6C63FF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  permBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  // Test notification
  testBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 12, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2,
  },
  testBtnText: { fontSize: 14, fontWeight: '500' },
  // Toggles
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F2',
  },
  toggleLeft: { flex: 1, marginRight: 12 },
  toggleTitle: { fontSize: 15, fontWeight: '500' },
  toggleDesc: { fontSize: 12, marginTop: 4, lineHeight: 17 },
  // Frequency
  freqRow: { padding: 16, gap: 10 },
  freqBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E8E8F0',
  },
  freqBtnActive: { borderColor: '#6C63FF', backgroundColor: 'rgba(108,99,255,0.04)' },
  freqLabel: { fontSize: 14, fontWeight: '500', color: '#6B6B8D' },
  freqDesc: { fontSize: 12 },
  // DND
  dndRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 14 },
  dndLabel: { fontSize: 14, color: '#6B6B8D' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  timeBox: {
    flex: 1, backgroundColor: '#F5F4FA', borderRadius: 10,
    paddingVertical: 12, alignItems: 'center',
  },
  timeText: { fontSize: 16, fontWeight: '600' },
  timeSep: { fontSize: 14 },
});
