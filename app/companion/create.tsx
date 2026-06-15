/**
 * Curoco — Create Companion (Redesigned)
 */

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Switch, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCompanionStore } from '../../src/store/companionStore';
import GlassButton from '../../src/components/common/GlassButton';

export default function CreateCompanionPage() {
  const router = useRouter();
  const { addCompanion } = useCompanionStore();
  const [name, setName] = useState('');
  const [age, setAge] = useState('22');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [relationship, setRelationship] = useState('恋人');
  const [nickname, setNickname] = useState('');
  const [personality, setPersonality] = useState('');
  const [backstory, setBackstory] = useState('');
  const [speakingStyle, setSpeakingStyle] = useState('');
  const [tabooTopics, setTabooTopics] = useState('');
  const [likes, setLikes] = useState('');
  const [catchphrase, setCatchphrase] = useState('');
  const [emotionStyle, setEmotionStyle] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [proactive, setProactive] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!name.trim()) { Alert.alert('提示', '请输入姓名'); return; }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 200) { Alert.alert('提示', '请输入有效年龄'); return; }
    setSaving(true);
    try {
      const result = await addCompanion({
        name: name.trim(), avatarUri: '', gender, age: ageNum, relationship,
        nicknameForUser: nickname.trim() || '你',
        personality: personality.trim() || '温柔体贴，善解人意',
        backstory: backstory.trim(), worldSetting: '',
        voiceEnabled, proactiveMessageEnabled: proactive,
        proactiveMessageIntervalMin: 4, proactiveMessageIntervalMax: 12,
        ttsVoiceId: null, ttsVoiceSampleUri: null,
        coverUri: null, signature: null, chatBackgroundUri: null, chatBackgroundOpacity: 0.15,
        autoFollowUpEnabled: false, autoFollowUpTimeoutMin: 30,
        speakingStyle: speakingStyle.trim(),
        tabooTopics: tabooTopics.trim(),
        likes: likes.trim(),
        catchphrase: catchphrase.trim(),
        emotionStyle: emotionStyle.trim(),
      });
      Alert.alert('创建成功', `${result.companion.name} 已准备好和你聊天了！`, [
        { text: '开始聊天', onPress: () => router.replace({
          pathname: '/chat/[id]',
          params: { id: result.conversationId, companionId: result.companion.id, name: result.companion.name },
        })},
      ]);
    } catch (e: any) { Alert.alert('创建失败', e?.message || '请稍后重试'); }
    finally { setSaving(false); }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>基本信息</Text>
      <View style={styles.section}>
        <Field label="姓名 *" value={name} onChange={setName} placeholder="给你的角色起个名字" />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}><Field label="年龄" value={age} onChange={(t: string) => setAge(t.replace(/[^0-9]/g, ''))} placeholder="22" keyboardType="number-pad" maxLength={3} /></View>
          <View style={{ flex: 2 }}><Field label="关系" value={relationship} onChange={setRelationship} placeholder="恋人、死党..." /></View>
        </View>
        <Text style={styles.label}>性别</Text>
        <View style={styles.genderRow}>
          {([['female', '女', 'female'], ['male', '男', 'male'], ['other', '其他', 'transgender']] as const).map(([k, l, icon]) => (
            <TouchableOpacity key={k} style={[styles.genderBtn, gender === k && styles.genderActive]} onPress={() => setGender(k)}>
              <Ionicons name={icon as any} size={18} color={gender === k ? '#fff' : '#6B6B8D'} />
              <Text style={[styles.genderText, gender === k && { color: '#fff', fontWeight: '600' }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="对你的称呼" value={nickname} onChange={setNickname} placeholder="宝贝、亲爱的..." />
      </View>

      <Text style={styles.sectionTitle}>性格与背景</Text>
      <View style={styles.section}>
        <Field label="性格特征" value={personality} onChange={setPersonality} placeholder="温柔体贴，善解人意..." multiline />
        <Field label="背景故事" value={backstory} onChange={setBackstory} placeholder="详细的个人经历..." multiline />
      </View>

      <Text style={styles.sectionTitle}>角色细节</Text>
      <View style={styles.section}>
        <Field label="语言特点" value={speakingStyle} onChange={setSpeakingStyle} placeholder="说话风格、语气特点..." multiline />
        <Field label="口头禅" value={catchphrase} onChange={setCatchphrase} placeholder="经常说的口头禅..." />
        <Field label="情感表达方式" value={emotionStyle} onChange={setEmotionStyle} placeholder="表达情感的方式..." multiline />
        <Field label="喜好/兴趣" value={likes} onChange={setLikes} placeholder="喜欢的事物、兴趣爱好..." multiline />
        <Field label="禁忌话题" value={tabooTopics} onChange={setTabooTopics} placeholder="绝不能提及的话题..." multiline />
      </View>

      <Text style={styles.sectionTitle}>功能</Text>
      <View style={styles.section}>
        <SwitchRow label="语音消息" hint="允许 AI 发送语音" value={voiceEnabled} onChange={setVoiceEnabled} />
        <SwitchRow label="主动消息" hint="在你没说话时主动问候" value={proactive} onChange={setProactive} />
      </View>

      <GlassButton
        label={saving ? '创建中...' : '创建角色'}
        onPress={handleCreate}
        variant="primary"
        disabled={saving}
        style={{ marginTop: 20 }}
      />
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType, maxLength }: any) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#A0A0B8" multiline={multiline} keyboardType={keyboardType} maxLength={maxLength} />
    </View>
  );
}

function SwitchRow({ label, hint, value, onChange }: any) {
  return (
    <View style={styles.switchRow}>
      <View><Text style={styles.label}>{label}</Text><Text style={styles.hint}>{hint}</Text></View>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7FC' },
  content: { padding: 16, paddingBottom: 40 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6B6B8D', marginBottom: 8, marginTop: 20, textTransform: 'uppercase', letterSpacing: 0.5 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '600', color: '#1A1A2E', marginBottom: 8 },
  hint: { fontSize: 12, color: '#A0A0B8', marginTop: 2 },
  input: { borderWidth: 1.5, borderColor: '#E8E8F0', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: '#1A1A2E', backgroundColor: '#FAFAFE' },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  genderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: '#E8E8F0', backgroundColor: '#FAFAFE' },
  genderActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  genderText: { fontSize: 14, color: '#6B6B8D' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F8' },
  createBtn: { backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  createBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
