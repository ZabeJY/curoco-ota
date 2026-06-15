/**
 * Curoco — Persona Editor (Redesigned)
 */

import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CompanionRepository } from '../../../src/db/repositories/CompanionRepository';

export default function PersonaEditorPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [personality, setPersonality] = useState('');
  const [backstory, setBackstory] = useState('');
  const [worldSetting, setWorldSetting] = useState('');
  const [nickname, setNickname] = useState('');
  const [speakingStyle, setSpeakingStyle] = useState('');
  const [tabooTopics, setTabooTopics] = useState('');
  const [likes, setLikes] = useState('');
  const [catchphrase, setCatchphrase] = useState('');
  const [emotionStyle, setEmotionStyle] = useState('');

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    CompanionRepository.getById(id).then((c) => {
      if (c) {
        setPersonality(c.personality);
        setBackstory(c.backstory);
        setWorldSetting(c.worldSetting);
        setNickname(c.nicknameForUser);
        setSpeakingStyle(c.speakingStyle || '');
        setTabooTopics(c.tabooTopics || '');
        setLikes(c.likes || '');
        setCatchphrase(c.catchphrase || '');
        setEmotionStyle(c.emotionStyle || '');
      }
    }).catch(() => Alert.alert('错误', '加载失败')).finally(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      await CompanionRepository.update(id, {
        personality, backstory, worldSetting, nicknameForUser: nickname,
        speakingStyle, tabooTopics, likes, catchphrase, emotionStyle,
      });
      Alert.alert('保存成功', '', [{ text: '好的', onPress: () => router.back() }]);
    } catch { Alert.alert('保存失败'); }
    finally { setSaving(false); }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Field label="对你的称呼" value={nickname} onChange={setNickname} placeholder="宝贝、亲爱的..." />
      <Field label="性格特征" value={personality} onChange={setPersonality} placeholder="详细描述性格..." multiline />
      <Field label="背景故事" value={backstory} onChange={setBackstory} placeholder="详细的个人经历..." multiline />
      <Field label="世界观设定" value={worldSetting} onChange={setWorldSetting} placeholder="可选：自定义世界观..." multiline />
      <Text style={styles.subsectionTitle}>角色细节</Text>
      <Field label="语言特点" value={speakingStyle} onChange={setSpeakingStyle} placeholder="说话风格、语气特点..." multiline />
      <Field label="口头禅" value={catchphrase} onChange={setCatchphrase} placeholder="经常说的口头禅..." />
      <Field label="情感表达方式" value={emotionStyle} onChange={setEmotionStyle} placeholder="表达情感的方式..." multiline />
      <Field label="喜好/兴趣" value={likes} onChange={setLikes} placeholder="喜欢的事物、兴趣爱好..." multiline />
      <Field label="禁忌话题" value={tabooTopics} onChange={setTabooTopics} placeholder="绝不能提及的话题..." multiline />
      <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>保存</Text>}
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, multiline }: any) {
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A0A0B8" multiline={multiline} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FC' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  subsectionTitle: { fontSize: 13, fontWeight: '600', color: '#6B6B8D', marginTop: 20, marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 8 },
  input: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#E8E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1A1A2E' },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
