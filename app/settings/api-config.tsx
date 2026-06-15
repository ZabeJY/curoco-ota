/**
 * Curoco — API Config (Redesigned)
 */

import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettingsStore } from '../../src/store/settingsStore';
import type { ApiProviderType } from '../../src/types/models';

const PROVIDERS: Array<{ type: ApiProviderType; title: string; subtitle: string; icon: keyof typeof Ionicons.glyphMap; url: string; model: string }> = [
  { type: 'llm', title: '文本大模型', subtitle: '聊天核心', icon: 'chatbubbles', url: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { type: 'vision', title: '图像识别', subtitle: '解析图片', icon: 'eye', url: 'https://api.openai.com/v1', model: 'gpt-4o' },
  { type: 'asr', title: '语音识别', subtitle: '语音转文字', icon: 'mic', url: 'https://api.openai.com/v1', model: 'whisper-1' },
  { type: 'tts', title: '语音合成', subtitle: '文字转语音', icon: 'volume-high', url: 'https://api.openai.com/v1', model: 'tts-1' },
];

export default function ApiConfigPage() {
  const { apiConfigs, saveApiConfig } = useSettingsStore();
  const [editing, setEditing] = useState<ApiProviderType | null>(null);
  const [label, setLabel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  function openEditor(type: ApiProviderType) {
    const existing = apiConfigs[type];
    const p = PROVIDERS.find((x) => x.type === type)!;
    setEditing(type);
    setLabel(existing?.label || p.title);
    setBaseUrl(existing?.baseUrl || '');
    setApiKey(existing?.apiKey || '');
    setModel(existing?.modelName || '');
  }

  async function handleTest() {
    if (!baseUrl.trim() || !apiKey.trim()) { Alert.alert('提示', '请先填写 URL 和 Key'); return; }
    if (!editing) return;
    setTesting(true);
    try {
      let url = baseUrl.trim().replace(/\/+$/, '');
      if (!url.match(/\/v\d+$/)) url = url + '/v1';
      const isMiMo = url.includes('xiaomimimo');

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(isMiMo ? { 'api-key': apiKey.trim() } : { Authorization: `Bearer ${apiKey.trim()}` }),
      };

      let testResult = '';

      if (editing === 'asr') {
        // ASR: test endpoint reachability with minimal audio
        // MiMo uses m4a/AAC in production; WAV causes 500 on some servers
        const m4aBase64 = 'AAAAGGZ0eXBpc29tAAACAGlzb21pc28yAAAIZGluZgAAAAAAAAAACgAAAbAAABoA//8AAElDVABpb20A';
        if (isMiMo) {
          const testModel = model.trim() || 'mimo-v2.5-asr';
          try {
            const res = await fetch(`${url}/chat/completions`, {
              method: 'POST',
              headers,
              body: JSON.stringify({
                model: testModel,
                messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: `data:audio/mp4;base64,${m4aBase64}` } }] }],
                asr_options: { language: 'zh' },
              }),
            });
            if (res.ok) { testResult = `✅ ASR连接成功\n模型: ${testModel}`; }
            else {
              const e = await res.text();
              // 500 with server-side audio loading error = endpoint reachable, just bad test audio
              if (res.status === 500 && (e.includes('loading multimodal') || e.includes('loading data'))) {
                testResult = `✅ ASR连接成功\n模型: ${testModel}\n（服务器已响应，测试音频过小）`;
              } else {
                throw new Error(`状态码: ${res.status}\n${e.slice(0, 200)}`);
              }
            }
          } catch (err: any) {
            if (err.message?.includes('状态码')) throw err;
            throw new Error(`网络连接失败: ${err.message}`);
          }
        } else {
          // OpenAI-compatible ASR: test endpoint reachability
          const testModel = model.trim() || 'whisper-1';
          const byteChars = atob(m4aBase64);
          const bytes = new Uint8Array(byteChars.length);
          for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
          const form = new FormData();
          form.append('file', new Blob([bytes], { type: 'audio/mp4' }), 'test.m4a');
          form.append('model', testModel);
          const res = await fetch(`${url}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey.trim()}` }, body: form });
          if (res.ok) { testResult = `✅ ASR连接成功\n模型: ${testModel}`; }
          else {
            const e = await res.text();
            if (res.status === 500 && (e.includes('loading') || e.includes('data'))) {
              testResult = `✅ ASR连接成功\n模型: ${testModel}\n（服务器已响应，测试音频过小）`;
            } else {
              throw new Error(`状态码: ${res.status}\n${e.slice(0, 200)}`);
            }
          }
        }
      } else if (editing === 'tts') {
        // TTS: test synthesis endpoint
        const testModel = model.trim() || (isMiMo ? 'mimo-v2.5-tts' : 'tts-1');
        if (isMiMo) {
          const res = await fetch(`${url}/chat/completions`, {
            method: 'POST', headers,
            body: JSON.stringify({ model: testModel, messages: [{ role: 'user', content: '测试' }] }),
          });
          if (res.ok) { testResult = `✅ TTS连接成功\n模型: ${testModel}`; }
          else { const e = await res.text(); throw new Error(`状态码: ${res.status}\n${e.slice(0, 200)}`); }
        } else {
          const res = await fetch(`${url}/audio/speech`, {
            method: 'POST', headers: { ...headers, Authorization: `Bearer ${apiKey.trim()}` },
            body: JSON.stringify({ model: testModel, input: '测试', voice: 'alloy' }),
          });
          if (res.ok) { testResult = `✅ TTS连接成功\n模型: ${testModel}`; }
          else { const e = await res.text(); throw new Error(`状态码: ${res.status}\n${e.slice(0, 200)}`); }
        }
      } else {
        // LLM / Vision: test chat completions
        const testModel = model.trim() || (isMiMo ? 'mimo-v2.5-pro' : 'gpt-4o');
        const body: any = { model: testModel, messages: [{ role: 'user', content: 'Hi' }] };
        if (isMiMo) body.max_completion_tokens = 5; else body.max_tokens = 5;
        const res = await fetch(`${url}/chat/completions`, { method: 'POST', headers, body: JSON.stringify(body) });
        if (res.ok) {
          const data = await res.json();
          const reply = data?.choices?.[0]?.message?.content || '';
          testResult = `✅ 连接成功\n模型: ${testModel}\n回复: ${reply.slice(0, 100)}`;
        } else { const e = await res.text(); throw new Error(`状态码: ${res.status}\n${e.slice(0, 200)}`); }
      }

      Alert.alert('测试通过', testResult);
    } catch (e: any) { Alert.alert('❌ 连接失败', e?.message || '网络错误'); }
    finally { setTesting(false); }
  }

  async function handleSave() {
    if (!editing) return;
    if (!baseUrl.trim() || !apiKey.trim()) { Alert.alert('提示', '请填写 URL 和 Key'); return; }
    setSaving(true);
    const result = await saveApiConfig({
      providerType: editing, label: label.trim() || PROVIDERS.find((p) => p.type === editing)!.title,
      baseUrl: baseUrl.trim().replace(/\/+$/, ''), apiKey: apiKey.trim(),
      modelName: model.trim() || null, isActive: true, extraHeaders: null,
    });
    setSaving(false);
    if (result.success) { Alert.alert('✅ 保存成功'); setEditing(null); }
    else Alert.alert('❌ 保存失败', result.error || '请重试');
  }

  if (editing) {
    const p = PROVIDERS.find((x) => x.type === editing)!;
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setEditing(null)} style={styles.backBtn}><Ionicons name="arrow-back" size={24} color="#1A1A2E" /></TouchableOpacity>
          <Text style={styles.headerTitle}>{p.title}</Text>
          <View style={{ width: 40 }} />
        </View>
        <Field label="配置名称" value={label} onChange={setLabel} placeholder={p.title} />
        <Field label="Base URL" value={baseUrl} onChange={setBaseUrl} placeholder={p.url} hint="OpenAI 兼容接口地址" />
        <Field label="API Key" value={apiKey} onChange={setApiKey} placeholder="sk-..." secure />
        <Field label="模型名称" value={model} onChange={setModel} placeholder={p.model} hint="如 gpt-4o, deepseek-chat" />
        <View style={styles.actions}>
          <TouchableOpacity style={styles.testBtn} onPress={handleTest} disabled={testing}>
            {testing ? <ActivityIndicator size="small" color="#6C63FF" /> : <Ionicons name="flash-outline" size={18} color="#6C63FF" />}
            <Text style={styles.testBtnText}>{testing ? '测试中...' : '测试连接'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>保存</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.hint}>为不同功能分别配置 API，支持任何 OpenAI 兼容格式</Text>
      {PROVIDERS.map((p) => {
        const config = apiConfigs[p.type];
        return (
          <TouchableOpacity key={p.type} style={styles.card} onPress={() => openEditor(p.type)} activeOpacity={0.7}>
            <View style={[styles.cardIcon, !config && { backgroundColor: '#F0EFF5' }]}>
              <Ionicons name={p.icon} size={22} color={config ? '#6C63FF' : '#A0A0B8'} />
            </View>
            <View style={styles.cardBody}>
              <View style={styles.cardTop}>
                <Text style={styles.cardTitle}>{p.title}</Text>
                <View style={[styles.badge, config ? { backgroundColor: 'rgba(108,99,255,0.12)' } : { backgroundColor: '#F0F0F5' }]}>
                  <Text style={[styles.badgeText, config ? { color: '#6C63FF' } : { color: '#A0A0B8' }]}>{config ? '已配置' : '未配置'}</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>{p.subtitle}</Text>
              {config && <Text style={styles.cardDetail} numberOfLines={1}>{config.modelName || config.baseUrl}</Text>}
            </View>
            <Ionicons name="chevron-forward" size={18} color="#A0A0B8" />
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, hint, secure }: any) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A0A0B8" autoCapitalize="none" autoCorrect={false} secureTextEntry={secure} />
      {hint && <Text style={styles.fieldHint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FC' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', color: '#1A1A2E' },
  hint: { fontSize: 13, color: '#6B6B8D', marginBottom: 16, lineHeight: 20 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  cardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(108,99,255,0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  cardBody: { flex: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#1A1A2E' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: '500' },
  cardSub: { fontSize: 12, color: '#6B6B8D', marginTop: 2 },
  cardDetail: { fontSize: 11, color: '#A0A0B8', marginTop: 4 },
  fieldGroup: { marginBottom: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 8 },
  fieldInput: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#E8E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1A1A2E' },
  fieldHint: { fontSize: 12, color: '#A0A0B8', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  testBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 12, borderWidth: 1.5, borderColor: '#6C63FF', backgroundColor: '#FFFFFF' },
  testBtnText: { fontSize: 15, fontWeight: '600', color: '#6C63FF' },
  saveBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, backgroundColor: '#6C63FF' },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
});
