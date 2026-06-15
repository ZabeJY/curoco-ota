/**
 * Curoco — Companion Settings
 * Voice: select from preset+cloned list OR text description
 * Proactive messaging, auto follow-up
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, TouchableOpacity, ScrollView, StyleSheet,
  Alert, ActivityIndicator, TextInput,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CompanionRepository } from '../../../src/db/repositories/CompanionRepository';
import { ConversationRepository } from '../../../src/db/repositories/ConversationRepo';
import { MessageRepository } from '../../../src/db/repositories/MessageRepository';
import { SettingsRepository } from '../../../src/db/repositories/SettingsRepository';
import { ScheduleRepository } from '../../../src/db/repositories/ScheduleRepository';
import { VoiceStore, type ClonedVoice } from '../../../src/utils/voiceStore';
import { useTheme } from '../../../src/theme/ThemeProvider';
import type { Companion } from '../../../src/types/models';

const PRESET_VOICES = ['Chloe', 'Alloy', 'Echo', 'Fable', 'Onyx', 'Nova', 'Shimmer'];

// ttsVoiceId format:
//   "preset:<name>" — select from list
//   "design:<description>" — text description
//   "clone:<voice_id>" — cloned voice (legacy, same as preset for MiMo)

type VoiceMode = 'select' | 'design';

function parseVoiceConfig(ttsVoiceId: string | null, ttsVoiceSampleUri: string | null, clonedVoices: ClonedVoice[]): { mode: VoiceMode; selectedVoice: string; designText: string } {
  if (!ttsVoiceId) return { mode: 'select', selectedVoice: 'Chloe', designText: '' };
  if (ttsVoiceId.startsWith('design:')) return { mode: 'design', selectedVoice: '', designText: ttsVoiceId.slice(7) };
  if (ttsVoiceId === 'clone' && ttsVoiceSampleUri) {
    // Find the cloned voice by file URI
    const match = clonedVoices.find((v) => v.voiceId === ttsVoiceSampleUri);
    return { mode: 'select', selectedVoice: ttsVoiceSampleUri, designText: '' };
  }
  if (ttsVoiceId.startsWith('preset:')) return { mode: 'select', selectedVoice: ttsVoiceId.slice(7), designText: '' };
  return { mode: 'select', selectedVoice: ttsVoiceId, designText: '' };
}

export default function CompanionSettingsPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('select');
  const [selectedVoice, setSelectedVoice] = useState('Chloe');
  const [designText, setDesignText] = useState('');
  const [clonedVoices, setClonedVoices] = useState<ClonedVoice[]>([]);

  const [proactiveEnabled, setProactiveEnabled] = useState(false);
  const [intervalMin, setIntervalMin] = useState('4');
  const [intervalMax, setIntervalMax] = useState('12');
  const [autoFollowUp, setAutoFollowUp] = useState(false);
  const [autoFollowUpTimeout, setAutoFollowUpTimeout] = useState('30');
  const [scheduleType, setScheduleType] = useState<'random' | 'fixed'>('random');
  const [fixedTimes, setFixedTimes] = useState<string[]>(['08:00', '23:30']);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      try {
        const [comp, tts, voices] = await Promise.all([
          CompanionRepository.getById(id),
          SettingsRepository.getActiveApiConfig('tts'),
          VoiceStore.getAll(),
        ]);
        setClonedVoices(voices);

        if (comp) {
          setVoiceEnabled(comp.voiceEnabled);
          const parsed = parseVoiceConfig(comp.ttsVoiceId, comp.ttsVoiceSampleUri, voices);
          setVoiceMode(parsed.mode);
          setSelectedVoice(parsed.selectedVoice);
          setDesignText(parsed.designText);

          setProactiveEnabled(comp.proactiveMessageEnabled);
          setIntervalMin(String(comp.proactiveMessageIntervalMin));
          setIntervalMax(String(comp.proactiveMessageIntervalMax));
          setAutoFollowUp(comp.autoFollowUpEnabled);
          setAutoFollowUpTimeout(String(comp.autoFollowUpTimeoutMin));
        }

        const schedule = await ScheduleRepository.getByCompanion(id);
        if (schedule) {
          setScheduleType(schedule.type);
          setFixedTimes(JSON.parse(schedule.fixedTimes));
        }
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  async function handleSave() {
    if (!id) return;
    const min = parseInt(intervalMin, 10);
    const max = parseInt(intervalMax, 10);
    if (isNaN(min) || isNaN(max) || min < 1 || max < min) {
      Alert.alert('提示', '请输入有效的时间间隔');
      return;
    }

    setSaving(true);
    try {
      let ttsVoiceId: string | null = null;
      let ttsVoiceSampleUri: string | null = null;
      if (voiceEnabled) {
        if (voiceMode === 'design') {
          ttsVoiceId = designText.trim() ? `design:${designText.trim()}` : null;
        } else {
          // Check if selected voice is a cloned voice (has file URI) or preset
          const clonedMatch = clonedVoices.find((v) => v.voiceId === selectedVoice);
          if (clonedMatch) {
            ttsVoiceId = 'clone';
            ttsVoiceSampleUri = selectedVoice; // file URI
          } else {
            ttsVoiceId = selectedVoice || null; // preset name like "Chloe"
          }
        }
      }

      const followUpTimeout = parseInt(autoFollowUpTimeout, 10);
      await CompanionRepository.update(id, {
        voiceEnabled,
        ttsVoiceId,
        ttsVoiceSampleUri,
        proactiveMessageEnabled: proactiveEnabled,
        proactiveMessageIntervalMin: min,
        proactiveMessageIntervalMax: max,
        autoFollowUpEnabled: autoFollowUp,
        autoFollowUpTimeoutMin: isNaN(followUpTimeout) ? 30 : followUpTimeout,
      });

      await ScheduleRepository.upsert({
        companionId: id,
        type: scheduleType,
        fixedTimes: scheduleType === 'fixed' ? fixedTimes : [],
        randomIntervalMin: min,
        randomIntervalMax: max,
        isActive: proactiveEnabled,
      });

      Alert.alert('保存成功');
    } catch (e: any) {
      Alert.alert('保存失败', e?.message || '请重试');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>;

  // Build voice list: presets + cloned
  // For cloned voices, id = file URI (used as selectedVoice value)
  const allVoices = [
    ...PRESET_VOICES.map((name) => ({ id: name, name, type: 'preset' as const })),
    ...clonedVoices.map((v) => ({ id: v.voiceId, name: v.name, type: 'cloned' as const })),
  ];

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bgPrimary }]} contentContainerStyle={styles.content}>
      {/* Voice section */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>语音设置</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.label, { color: theme.textPrimary }]}>允许发送语音消息</Text>
            <Text style={[styles.hint, { color: theme.textTertiary }]}>开启后 AI 会用语音回复你</Text>
          </View>
          <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} />
        </View>

        {voiceEnabled && (
          <>
            <View style={styles.divider} />

            {/* Voice mode tabs */}
            <View style={styles.modeTabs}>
              <TouchableOpacity
                style={[styles.modeTab, voiceMode === 'select' && styles.modeTabActive]}
                onPress={() => setVoiceMode('select')}
              >
                <Ionicons name="list" size={16} color={voiceMode === 'select' ? '#fff' : '#6B6B8D'} />
                <Text style={[styles.modeTabText, voiceMode === 'select' && { color: '#fff' }]}>选择音色</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeTab, voiceMode === 'design' && styles.modeTabActive]}
                onPress={() => setVoiceMode('design')}
              >
                <Ionicons name="create-outline" size={16} color={voiceMode === 'design' ? '#fff' : '#6B6B8D'} />
                <Text style={[styles.modeTabText, voiceMode === 'design' && { color: '#fff' }]}>文本描述</Text>
              </TouchableOpacity>
            </View>

            {voiceMode === 'select' ? (
              <>
                <Text style={[styles.hint, { color: theme.textSecondary, marginBottom: 8 }]}>
                  选择预置音色或已克隆的音色
                </Text>
                {allVoices.map((v) => (
                  <TouchableOpacity
                    key={v.id}
                    style={[styles.voiceRow, selectedVoice === v.id && styles.voiceRowActive]}
                    onPress={() => setSelectedVoice(v.id)}
                  >
                    <Ionicons
                      name={selectedVoice === v.id ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selectedVoice === v.id ? '#6C63FF' : theme.textTertiary}
                    />
                    <Text style={[styles.voiceName, { color: theme.textPrimary }]}>{v.name}</Text>
                    <View style={[styles.voiceTag, v.type === 'cloned' ? styles.tagCloned : styles.tagPreset]}>
                      <Text style={[styles.voiceTagText, v.type === 'cloned' ? styles.tagTextCloned : styles.tagTextPreset]}>
                        {v.type === 'cloned' ? '克隆' : '预置'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
                {clonedVoices.length === 0 && (
                  <Text style={{ color: theme.textTertiary, fontSize: 12, marginTop: 8 }}>
                    还没有克隆音色。去「我 → 音色克隆」上传音频。
                  </Text>
                )}
              </>
            ) : (
              <>
                <Text style={[styles.hint, { color: theme.textSecondary, marginBottom: 8 }]}>
                  用文字描述你想要的音色特征
                </Text>
                <TextInput
                  style={[styles.input, { color: theme.textPrimary, borderColor: theme.border, minHeight: 80, textAlignVertical: 'top' }]}
                  value={designText}
                  onChangeText={setDesignText}
                  placeholder="A young woman with a sweet, gentle voice..."
                  placeholderTextColor={theme.textTertiary}
                  multiline
                />
              </>
            )}
          </>
        )}
      </View>

      {/* Proactive messaging */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>主动消息</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.label, { color: theme.textPrimary }]}>开启主动消息</Text>
            <Text style={[styles.hint, { color: theme.textTertiary }]}>AI 会在你没说话时主动发来问候</Text>
          </View>
          <Switch value={proactiveEnabled} onValueChange={setProactiveEnabled} />
        </View>
        {proactiveEnabled && (
          <>
            <View style={styles.divider} />
            <View style={styles.typeRow}>
              {(['random', 'fixed'] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, scheduleType === t && styles.typeBtnActive]}
                  onPress={() => setScheduleType(t)}
                >
                  <Ionicons name={t === 'random' ? 'shuffle' : 'time'} size={16} color={scheduleType === t ? '#fff' : '#6B6B8D'} />
                  <Text style={[styles.typeText, scheduleType === t && { color: '#fff' }]}>{t === 'random' ? '随机' : '固定'}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {scheduleType === 'random' ? (
              <View style={styles.intervalRow}>
                <Text style={[styles.hint, { color: theme.textSecondary }]}>间隔</Text>
                <TextInput style={[styles.intervalInput, { color: theme.textPrimary, borderColor: theme.border }]} value={intervalMin} onChangeText={setIntervalMin} keyboardType="number-pad" />
                <Text style={[styles.hint, { color: theme.textSecondary }]}>~</Text>
                <TextInput style={[styles.intervalInput, { color: theme.textPrimary, borderColor: theme.border }]} value={intervalMax} onChangeText={setIntervalMax} keyboardType="number-pad" />
                <Text style={[styles.hint, { color: theme.textSecondary }]}>小时</Text>
              </View>
            ) : (
              <View>
                {fixedTimes.map((t, i) => (
                  <View key={i} style={styles.timeRow}>
                    <TextInput style={[styles.timeInput, { color: theme.textPrimary, borderColor: theme.border }]} value={t} onChangeText={(v) => { const nt = [...fixedTimes]; nt[i] = v; setFixedTimes(nt); }} placeholder="HH:MM" placeholderTextColor={theme.textTertiary} />
                    <TouchableOpacity onPress={() => setFixedTimes(fixedTimes.filter((_, idx) => idx !== i))}><Ionicons name="close-circle" size={20} color="#FF4757" /></TouchableOpacity>
                  </View>
                ))}
                <TouchableOpacity style={styles.addTimeBtn} onPress={() => setFixedTimes([...fixedTimes, ''])}>
                  <Ionicons name="add-circle-outline" size={18} color="#6C63FF" /><Text style={styles.addTimeText}>添加时间</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>

      {/* Auto follow-up */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>自动追问</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.switchRow}>
          <View>
            <Text style={[styles.label, { color: theme.textPrimary }]}>开启自动追问</Text>
            <Text style={[styles.hint, { color: theme.textTertiary }]}>话题结束或超时未回复时 AI 主动发消息</Text>
          </View>
          <Switch value={autoFollowUp} onValueChange={setAutoFollowUp} />
        </View>
        {autoFollowUp && (
          <>
            <View style={styles.divider} />
            <View style={styles.intervalRow}>
              <Text style={[styles.hint, { color: theme.textSecondary }]}>无回复</Text>
              <TextInput style={[styles.intervalInput, { color: theme.textPrimary, borderColor: theme.border }]} value={autoFollowUpTimeout} onChangeText={setAutoFollowUpTimeout} keyboardType="number-pad" />
              <Text style={[styles.hint, { color: theme.textSecondary }]}>分钟后追问</Text>
            </View>
          </>
        )}
      </View>

      {/* Memory management */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>记忆管理</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <Text style={[styles.hint, { color: theme.textSecondary, marginBottom: 12 }]}>
          重置记忆会清除角色的长期记忆摘要和所有聊天记录，角色将像初次认识你一样。
        </Text>
        <TouchableOpacity
          style={styles.resetBtn}
          onPress={() => {
            Alert.alert('重置记忆', '确定要重置角色的所有记忆吗？此操作不可撤销。', [
              { text: '取消', style: 'cancel' },
              {
                text: '重置', style: 'destructive',
                onPress: async () => {
                  if (!id) return;
                  try {
                    await ConversationRepository.updateLongTermMemory(id, '');
                    await ConversationRepository.decrementMessageCount(id, 9999);
                    const msgs = await MessageRepository.getRecent(id, 9999);
                    if (msgs.length > 0) await MessageRepository.deleteByIds(msgs.map((m) => m.id));
                    await ConversationRepository.resetUnread(id);
                    Alert.alert('已重置', '角色记忆已清空');
                  } catch (e) {
                    Alert.alert('重置失败');
                  }
                },
              },
            ]);
          }}
        >
          <Ionicons name="refresh-circle-outline" size={18} color="#FF4757" />
          <Text style={styles.resetBtnText}>重置记忆</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>保存设置</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 20 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 15, fontWeight: '500' },
  hint: { fontSize: 12, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: '#F0F0F8', marginVertical: 12 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  modeTabs: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  modeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E8E8F0' },
  modeTabActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  modeTabText: { fontSize: 13, fontWeight: '600', color: '#6B6B8D' },
  voiceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F8' },
  voiceRowActive: { backgroundColor: 'rgba(108,99,255,0.04)' },
  voiceName: { flex: 1, fontSize: 14, fontWeight: '500' },
  voiceTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  tagPreset: { backgroundColor: '#F0F0F5' },
  tagCloned: { backgroundColor: 'rgba(108,99,255,0.12)' },
  voiceTagText: { fontSize: 10, fontWeight: '500' },
  tagTextPreset: { color: '#6B6B8D' },
  tagTextCloned: { color: '#6C63FF' },
  typeRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E8E8F0' },
  typeBtnActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  typeText: { fontSize: 13, fontWeight: '600', color: '#6B6B8D' },
  intervalRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  intervalInput: { width: 50, borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, fontSize: 14, textAlign: 'center' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  timeInput: { flex: 1, borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  addTimeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 8 },
  addTimeText: { fontSize: 13, color: '#6C63FF', fontWeight: '500' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#FF4757' },
  resetBtnText: { color: '#FF4757', fontSize: 15, fontWeight: '600' },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
