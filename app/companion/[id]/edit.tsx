/**
 * Curoco — Companion Full Edit
 * Edit ALL companion settings (same fields as create page)
 */

import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet,
  Alert, Switch, ActivityIndicator, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { CompanionRepository } from '../../../src/db/repositories/CompanionRepository';
import { useTheme } from '../../../src/theme/ThemeProvider';
import Avatar from '../../../src/components/common/Avatar';
import Slider from '../../../src/components/common/Slider';
import GlassButton from '../../../src/components/common/GlassButton';
import type { Companion } from '../../../src/types/models';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024;

export default function CompanionEditPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [age, setAge] = useState('22');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');
  const [relationship, setRelationship] = useState('');
  const [nickname, setNickname] = useState('');
  const [personality, setPersonality] = useState('');
  const [backstory, setBackstory] = useState('');
  const [worldSetting, setWorldSetting] = useState('');
  const [speakingStyle, setSpeakingStyle] = useState('');
  const [tabooTopics, setTabooTopics] = useState('');
  const [likes, setLikes] = useState('');
  const [catchphrase, setCatchphrase] = useState('');
  const [emotionStyle, setEmotionStyle] = useState('');
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [proactive, setProactive] = useState(false);
  const [avatarUri, setAvatarUri] = useState('');
  const [chatBackgroundUri, setChatBackgroundUri] = useState('');
  const [chatBackgroundOpacity, setChatBackgroundOpacity] = useState(0.15);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    CompanionRepository.getById(id).then((c) => {
      if (c) {
        setName(c.name);
        setAge(String(c.age));
        setGender(c.gender);
        setRelationship(c.relationship);
        setNickname(c.nicknameForUser);
        setPersonality(c.personality);
        setBackstory(c.backstory);
        setWorldSetting(c.worldSetting);
        setSpeakingStyle(c.speakingStyle || '');
        setTabooTopics(c.tabooTopics || '');
        setLikes(c.likes || '');
        setCatchphrase(c.catchphrase || '');
        setEmotionStyle(c.emotionStyle || '');
        setVoiceEnabled(c.voiceEnabled);
        setProactive(c.proactiveMessageEnabled);
        setAvatarUri(c.avatarUri || '');
        setChatBackgroundUri(c.chatBackgroundUri || '');
        setChatBackgroundOpacity(c.chatBackgroundOpacity ?? 0.15);
      }
    }).catch(() => Alert.alert('错误', '加载失败')).finally(() => setLoading(false));
  }, [id]);

  async function handlePickAvatar() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      if ((file.size || 0) > MAX_AVATAR_SIZE) {
        Alert.alert('图片太大', `需小于 5MB`);
        return;
      }
      const cacheDir = (FileSystem.cacheDirectory || '') + 'avatars/';
      try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
      const ext = file.name?.split('.').pop() || 'jpg';
      const destUri = cacheDir + 'comp_' + Date.now() + '.' + ext;
      await FileSystem.copyAsync({ from: file.uri, to: destUri });
      setAvatarUri(destUri);
    } catch (e: any) {
      Alert.alert('选择图片失败', e?.message || '请重试');
    }
  }

  async function handlePickBackground() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];
      if ((file.size || 0) > 5 * 1024 * 1024) {
        Alert.alert('图片太大', '需小于 5MB');
        return;
      }
      const cacheDir = (FileSystem.cacheDirectory || '') + 'chat_bg/';
      try { await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true }); } catch {}
      const ext = file.name?.split('.').pop() || 'jpg';
      const destUri = cacheDir + 'bg_' + Date.now() + '.' + ext;
      await FileSystem.copyAsync({ from: file.uri, to: destUri });
      setChatBackgroundUri(destUri);
    } catch (e: any) {
      Alert.alert('选择图片失败', e?.message || '请重试');
    }
  }

  async function handleSave() {
    if (!id) return;
    if (!name.trim()) { Alert.alert('提示', '请输入姓名'); return; }
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 1 || ageNum > 200) { Alert.alert('提示', '请输入有效年龄'); return; }

    setSaving(true);
    try {
      await CompanionRepository.update(id, {
        name: name.trim(),
        avatarUri,
        gender,
        age: ageNum,
        relationship: relationship.trim(),
        nicknameForUser: nickname.trim() || '你',
        personality: personality.trim(),
        backstory: backstory.trim(),
        worldSetting: worldSetting.trim(),
        speakingStyle: speakingStyle.trim(),
        tabooTopics: tabooTopics.trim(),
        likes: likes.trim(),
        catchphrase: catchphrase.trim(),
        emotionStyle: emotionStyle.trim(),
        voiceEnabled,
        proactiveMessageEnabled: proactive,
        chatBackgroundUri: chatBackgroundUri || null,
        chatBackgroundOpacity,
      });
      Alert.alert('保存成功', '', [{ text: '好的', onPress: () => router.back() }]);
    } catch (e: any) {
      Alert.alert('保存失败', e?.message || '请重试');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#6C63FF" /></View>;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bgPrimary }]} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.7}>
          <View style={styles.avatarWrap}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
            ) : (
              <Avatar uri={null} name={name || '?'} size="xl" />
            )}
            <View style={styles.avatarBadge}>
              <Ionicons name="camera" size={16} color="#fff" />
            </View>
          </View>
        </TouchableOpacity>
        <Text style={[styles.avatarHint, { color: theme.textTertiary }]}>点击更换头像（JPG/PNG/WebP，&lt;5MB）</Text>
      </View>

      {/* Chat Background */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>聊天背景</Text>
      <View style={[styles.section, { backgroundColor: theme.bgSecondary }]}>
        <TouchableOpacity onPress={handlePickBackground} activeOpacity={0.7} style={{ alignItems: 'center' }}>
          {chatBackgroundUri ? (
            <Image source={{ uri: chatBackgroundUri }} style={{ width: '100%', height: 160, borderRadius: 12 }} resizeMode="cover" />
          ) : (
            <View style={{ width: '100%', height: 120, borderRadius: 12, backgroundColor: theme.bgTertiary, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="image-outline" size={32} color={theme.textTertiary} />
              <Text style={{ color: theme.textTertiary, fontSize: 13, marginTop: 8 }}>点击设置聊天背景</Text>
            </View>
          )}
        </TouchableOpacity>
        {chatBackgroundUri ? (
          <>
            <TouchableOpacity onPress={() => setChatBackgroundUri('')} style={{ marginTop: 8, alignItems: 'center' }}>
              <Text style={{ color: '#FF4757', fontSize: 13 }}>移除背景</Text>
            </TouchableOpacity>
            <View style={{ marginTop: 12 }}>
              <Slider
                value={chatBackgroundOpacity} min={0.05} max={0.5} step={0.05}
                onChange={(v) => setChatBackgroundOpacity(v)}
                onSlidingComplete={(v) => setChatBackgroundOpacity(v)}
                trackColor={theme.primary} thumbColor={theme.primary}
                label="背景透明度" unit=""
              />
            </View>
          </>
        ) : null}
      </View>

      {/* Basic info */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>基本信息</Text>
      <View style={[styles.section, { backgroundColor: theme.bgSecondary }]}>
        <Field label="姓名 *" value={name} onChange={setName} placeholder="名字" theme={theme} />
        <View style={styles.row}>
          <View style={{ flex: 1, marginRight: 8 }}>
            <Field label="年龄" value={age} onChange={(t: string) => setAge(t.replace(/[^0-9]/g, ''))} placeholder="22" keyboardType="number-pad" maxLength={3} theme={theme} />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="关系" value={relationship} onChange={setRelationship} placeholder="恋人、死党..." theme={theme} />
          </View>
        </View>
        <Text style={[styles.label, { color: theme.textPrimary }]}>性别</Text>
        <View style={styles.genderRow}>
          {([['female', '女', 'female'], ['male', '男', 'male'], ['other', '其他', 'transgender']] as const).map(([k, l, icon]) => (
            <TouchableOpacity key={k} style={[styles.genderBtn, gender === k && styles.genderActive]} onPress={() => setGender(k)}>
              <Ionicons name={icon as any} size={18} color={gender === k ? '#fff' : '#6B6B8D'} />
              <Text style={[styles.genderText, gender === k && { color: '#fff', fontWeight: '600' }]}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Field label="对你的称呼" value={nickname} onChange={setNickname} placeholder="宝贝、亲爱的..." theme={theme} />
      </View>

      {/* Personality */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>性格与背景</Text>
      <View style={[styles.section, { backgroundColor: theme.bgSecondary }]}>
        <Field label="性格特征" value={personality} onChange={setPersonality} placeholder="温柔体贴，善解人意..." multiline theme={theme} />
        <Field label="背景故事" value={backstory} onChange={setBackstory} placeholder="详细的个人经历..." multiline theme={theme} />
        <Field label="世界观设定" value={worldSetting} onChange={setWorldSetting} placeholder="可选：自定义世界观..." multiline theme={theme} />
      </View>

      {/* 角色细节 */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>角色细节</Text>
      <View style={[styles.section, { backgroundColor: theme.bgSecondary }]}>
        <Field label="语言特点" value={speakingStyle} onChange={setSpeakingStyle} placeholder="说话风格、语气特点..." multiline theme={theme} />
        <Field label="口头禅" value={catchphrase} onChange={setCatchphrase} placeholder="经常说的口头禅..." theme={theme} />
        <Field label="情感表达方式" value={emotionStyle} onChange={setEmotionStyle} placeholder="表达情感的方式..." multiline theme={theme} />
        <Field label="喜好/兴趣" value={likes} onChange={setLikes} placeholder="喜欢的事物、兴趣爱好..." multiline theme={theme} />
        <Field label="禁忌话题" value={tabooTopics} onChange={setTabooTopics} placeholder="绝不能提及的话题..." multiline theme={theme} />
      </View>

      {/* Features */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>功能</Text>
      <View style={[styles.section, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.switchRow}>
          <View><Text style={[styles.label, { color: theme.textPrimary }]}>语音消息</Text><Text style={[styles.hint, { color: theme.textTertiary }]}>允许 AI 发送语音</Text></View>
          <Switch value={voiceEnabled} onValueChange={setVoiceEnabled} />
        </View>
        <View style={styles.switchRow}>
          <View><Text style={[styles.label, { color: theme.textPrimary }]}>主动消息</Text><Text style={[styles.hint, { color: theme.textTertiary }]}>在你没说话时主动问候</Text></View>
          <Switch value={proactive} onValueChange={setProactive} />
        </View>
      </View>

      <GlassButton
        label={saving ? '保存中...' : '保存'}
        onPress={handleSave}
        variant="primary"
        disabled={saving}
        style={{ marginTop: 20 }}
      />
    </ScrollView>
  );
}

function Field({ label, value, onChange, placeholder, multiline, keyboardType, maxLength, theme }: any) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={[styles.label, { color: theme.textPrimary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        maxLength={maxLength}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarSection: { alignItems: 'center', paddingVertical: 20 },
  avatarWrap: { position: 'relative' },
  avatarImg: { width: 80, height: 80, borderRadius: 40 },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, backgroundColor: '#6C63FF', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#F8F7FC' },
  avatarHint: { fontSize: 12, marginTop: 8 },
  sectionTitle: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  section: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row' },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  hint: { fontSize: 12 },
  input: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, backgroundColor: '#FAFAFE' },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  genderBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E8E8F0', backgroundColor: '#FAFAFE' },
  genderActive: { backgroundColor: '#6C63FF', borderColor: '#6C63FF' },
  genderText: { fontSize: 14, color: '#6B6B8D' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F8' },
  saveBtn: { backgroundColor: '#6C63FF', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
