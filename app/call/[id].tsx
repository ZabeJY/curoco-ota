/**
 * Curoco — Voice Call Screen (v1.7.5 Refactored)
 * Elegant UI with glass morphism, smooth animations
 * VAD (continuous) / PTT (push-to-talk) modes
 * ASR → LLM → TTS loop with real-time transcript
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View, StyleSheet, Animated, Dimensions, TouchableOpacity,
  StatusBar, Text, PanResponder, ScrollView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import Avatar from '../../src/components/common/Avatar';
import BeamsBackground from '../../src/components/common/BeamsBackground';
import { CompanionRepository } from '../../src/db/repositories/CompanionRepository';
import { MessageRepository } from '../../src/db/repositories/MessageRepository';
import { ConversationRepository } from '../../src/db/repositories/ConversationRepo';
import { PersonaEngine } from '../../src/core/persona/PersonaEngine';
import { PromptBuilder } from '../../src/core/engine/PromptBuilder';
import { ResponseParser } from '../../src/core/engine/ResponseParser';
import { LLMClient } from '../../src/core/api/LLMClient';
import { ASRClient } from '../../src/core/api/ASRClient';
import { MiMoTTSClient } from '../../src/core/api/MiMoTTSClient';
import { TTSClient } from '../../src/core/api/TTSClient';
import { cleanForTTS } from '../../src/utils/textFilter';
import { useSettingsStore } from '../../src/store/settingsStore';
import type { Companion, ApiConfig } from '../../src/types/models';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const AVATAR_SIZE = 110;

type CallState = 'calling' | 'mode_select' | 'connected' | 'ended';
type ActiveState = 'idle' | 'listening' | 'thinking' | 'speaking';
type CallMode = 'vad' | 'ptt';

interface TranscriptLine {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

// ─── Recording config ───
const RECORDING_OPTIONS = {
  isMeteringEnabled: true,
  android: {
    extension: '.m4a',
    outputFormat: Audio.AndroidOutputFormat.MPEG_4,
    audioEncoder: Audio.AndroidAudioEncoder.AAC,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  ios: {
    extension: '.m4a',
    outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
    audioQuality: Audio.IOSAudioQuality.HIGH,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  },
  web: { mimeType: 'audio/mp4', bitsPerSecond: 128000 },
};

export default function VoiceCallScreen() {
  const { companionId, conversationId } = useLocalSearchParams<{
    companionId: string; conversationId?: string;
  }>();
  const router = useRouter();
  const { apiConfigs, settings } = useSettingsStore();
  const silenceThresholdDb = settings.vadSensitivity ?? -40;
  const silenceTimeoutMs = settings.silenceTimeoutMs ?? 1800;

  // ─── State ───
  const [companion, setCompanion] = useState<Companion | null>(null);
  const [callState, setCallState] = useState<CallState>('calling');
  const [activeState, setActiveState] = useState<ActiveState>('idle');
  const [isMuted, setIsMuted] = useState(false);
  const [asrWarning, setAsrWarning] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);

  // ─── Animations ───
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const breatheAnim = useRef(new Animated.Value(0)).current;
  const rippleAnims = useRef([
    { scale: new Animated.Value(0), opacity: new Animated.Value(0) },
    { scale: new Animated.Value(0), opacity: new Animated.Value(0) },
    { scale: new Animated.Value(0), opacity: new Animated.Value(0) },
  ]).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const btnScale = useRef(new Animated.Value(1)).current;
  const hangupScale = useRef(new Animated.Value(1)).current;

  // ─── Refs ───
  const durationRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);
  const soundRef = useRef<Audio.Sound | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const meteringTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const callModeRef = useRef<CallMode>('vad');
  const historyRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const hasSpokenRef = useRef(false);
  const hasListenedRef = useRef(false);
  const activeStateRef = useRef<ActiveState>('idle');
  const isMutedRef = useRef(false);
  const resolvedAsrConfig = useRef<ApiConfig | null>(null);

  // ─── Sync refs ───
  useEffect(() => { activeStateRef.current = activeState; }, [activeState]);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // ─── Resolve ASR config ───
  function resolveAsrConfig(): ApiConfig | null {
    if (apiConfigs.asr) return apiConfigs.asr;
    if (apiConfigs.llm?.baseUrl.includes('xiaomimimo')) {
      return { ...apiConfigs.llm, id: 'asr-inherited', providerType: 'asr' as const, label: 'ASR (继承)', modelName: 'mimo-v2.5-asr' };
    }
    return null;
  }

  // ─── Init ───
  useEffect(() => {
    cancelledRef.current = false;
    resolvedAsrConfig.current = resolveAsrConfig();
    if (!resolvedAsrConfig.current) setAsrWarning('未配置语音识别，请在设置中添加ASR或配置MiMo LLM');
    if (companionId) CompanionRepository.getById(companionId).then(c => { if (c && !cancelledRef.current) setCompanion(c); });

    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
    ]).start();

    // Breathing animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(breatheAnim, { toValue: 1, duration: 2500, useNativeDriver: true }),
        Animated.timing(breatheAnim, { toValue: 0, duration: 2500, useNativeDriver: true }),
      ])
    ).start();

    const connectTimer = setTimeout(() => { if (!cancelledRef.current) setCallState('mode_select'); }, 1800);

    return () => {
      cancelledRef.current = true;
      clearTimeout(connectTimer);
      if (timerRef.current) clearInterval(timerRef.current);
      if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);
      stopAudio();
      stopRecording();
    };
  }, []);

  // ─── Helpers ───
  function addTranscript(role: 'user' | 'assistant', text: string) {
    setTranscript(prev => [...prev, { role, text, timestamp: Date.now() }]);
  }

  async function stopAudio() {
    if (soundRef.current) {
      try { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); } catch {}
      soundRef.current = null;
    }
  }

  async function stopRecording() {
    if (meteringTimerRef.current) { clearInterval(meteringTimerRef.current); meteringTimerRef.current = null; }
    if (recordingRef.current) { try { await recordingRef.current.stopAndUnloadAsync(); } catch {} recordingRef.current = null; }
    silenceStartRef.current = null;
  }

  function formatDuration(sec: number): string {
    return `${Math.floor(sec / 60).toString().padStart(2, '0')}:${(sec % 60).toString().padStart(2, '0')}`;
  }

  function animatePress(ref: Animated.Value) {
    Animated.sequence([
      Animated.timing(ref, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.spring(ref, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]).start();
  }

  // ─── Ripple animations ───
  function startRipples() {
    rippleAnims.forEach((r, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 400),
          Animated.parallel([
            Animated.timing(r.scale, { toValue: 1, duration: 2200, useNativeDriver: true }),
            Animated.timing(r.opacity, { toValue: 0.25, duration: 400, useNativeDriver: true }),
          ]),
          Animated.timing(r.opacity, { toValue: 0, duration: 1800, useNativeDriver: true }),
          Animated.timing(r.scale, { toValue: 0, duration: 10, useNativeDriver: true }),
        ])
      ).start();
    });
  }

  // ─── Pulse animation for active state ───
  useEffect(() => {
    if (activeState === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [activeState]);

  // ─── TTS ───
  async function speakText(text: string): Promise<boolean> {
    if (!apiConfigs.tts || !companion || cancelledRef.current) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await stopAudio();
        const isMiMo = apiConfigs.tts.baseUrl.includes('xiaomimimo');
        let audioUri: string;
        if (isMiMo) {
          const client = new MiMoTTSClient(apiConfigs.tts);
          const ttsId = companion.ttsVoiceId || '';
          let model: any = 'mimo-v2.5-tts';
          let voice = 'Chloe';
          if (ttsId.startsWith('design:')) { model = 'mimo-v2.5-tts-voicedesign'; voice = ttsId.slice(7); }
          else if (ttsId === 'clone' || ttsId.startsWith('clone:')) {
            if (companion.ttsVoiceSampleUri) {
              try {
                const info = await FileSystem.getInfoAsync(companion.ttsVoiceSampleUri);
                if (info.exists) {
                  const b64 = await FileSystem.readAsStringAsync(companion.ttsVoiceSampleUri, { encoding: FileSystem.EncodingType.Base64 });
                  const ext = companion.ttsVoiceSampleUri.split('.').pop()?.toLowerCase() || 'mp3';
                  model = 'mimo-v2.5-tts-voiceclone';
                  voice = `data:audio/${ext === 'wav' ? 'wav' : 'mpeg'};base64,${b64}`;
                } else { voice = 'Chloe'; }
              } catch { voice = 'Chloe'; }
            } else { voice = 'Chloe'; }
          } else { voice = ttsId.startsWith('preset:') ? ttsId.slice(7) : (ttsId || 'Chloe'); }
          const ttsText = cleanForTTS(text).trim();
          if (!ttsText) return false;
          audioUri = await Promise.race([client.synthesize(ttsText, model, voice), new Promise<string>((_, rej) => setTimeout(() => rej(new Error('TTS timeout')), 30000))]);
        } else {
          const client = new TTSClient(apiConfigs.tts);
          const ttsText = cleanForTTS(text).trim();
          if (!ttsText) return false;
          audioUri = await Promise.race([client.synthesize(ttsText, companion.ttsVoiceId || 'alloy', 1.0), new Promise<string>((_, rej) => setTimeout(() => rej(new Error('TTS timeout')), 30000))]);
        }
        if (cancelledRef.current) return false;
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true, shouldDuckAndroid: true, staysActiveInBackground: false });
        const { sound } = await Audio.Sound.createAsync({ uri: audioUri }, { shouldPlay: true, volume: 1.0 });
        soundRef.current = sound;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => { sound.unloadAsync().catch(() => {}); soundRef.current = null; reject(new Error('Playback timeout')); }, Math.max(15000, text.length * 200 + 10000));
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) { clearTimeout(timeout); sound.unloadAsync().catch(() => {}); soundRef.current = null; hasSpokenRef.current = true; resolve(); }
            if (status.isLoaded && 'error' in status && status.error) { clearTimeout(timeout); sound.unloadAsync().catch(() => {}); soundRef.current = null; reject(new Error(String(status.error))); }
          });
        });
        return true;
      } catch { if (attempt < 2) await new Promise(r => setTimeout(r, 1000)); }
    }
    return false;
  }

  // ─── ASR + LLM cycle ───
  async function processAudio(uri: string): Promise<void> {
    if (cancelledRef.current || !resolvedAsrConfig.current) return;
    try {
      const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
      if (!base64 || base64.length < 100 || base64.length > 8 * 1024 * 1024) { setActiveState('idle'); return; }

      setActiveState('thinking');
      const asrClient = new ASRClient(resolvedAsrConfig.current);
      const mimeType = uri.endsWith('.wav') ? 'audio/wav' : 'audio/mp4';
      let userText = '';
      for (let attempt = 0; attempt < 2; attempt++) {
        try { userText = await asrClient.transcribe(base64, mimeType); if (userText.trim()) break; }
        catch (e: any) { console.warn(`[Call] ASR attempt ${attempt + 1}:`, e?.message); if (attempt === 0) await new Promise(r => setTimeout(r, 500)); }
      }

      if (cancelledRef.current || !userText.trim()) { setActiveState('idle'); return; }
      hasListenedRef.current = true;
      historyRef.current.push({ role: 'user', content: userText });
      addTranscript('user', userText);

      // LLM
      const persona = companionId ? await PersonaEngine.load(companionId) : null;
      if (!persona || !apiConfigs.llm) { setActiveState('idle'); return; }
      const llm = new LLMClient(apiConfigs.llm);
      const messages = [
        { role: 'system' as const, content: PromptBuilder.buildSystemPrompt(persona, 'voice_call') },
        ...historyRef.current.slice(-12),
      ];
      const raw = await llm.chat(messages);
      const aiText = ResponseParser.parse(raw).messages.join(' ');
      if (cancelledRef.current || !aiText) { setActiveState('idle'); return; }
      historyRef.current.push({ role: 'assistant', content: aiText });
      addTranscript('assistant', aiText);

      // TTS
      setActiveState('speaking');
      await speakText(aiText);
    } catch (e) { console.warn('[Call] Cycle error:', e); }
  }

  // ─── VAD ───
  async function startVadListening() {
    if (cancelledRef.current || activeStateRef.current !== 'idle' || isMutedRef.current || !resolvedAsrConfig.current) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      setActiveState('listening');
      silenceStartRef.current = null;
      meteringTimerRef.current = setInterval(async () => {
        if (!recordingRef.current || cancelledRef.current) return;
        try {
          const status = await recordingRef.current.getStatusAsync();
          if (!status.isRecording) return;
          const level = (status as any).metering ?? -160;
          if (level < silenceThresholdDb) {
            if (silenceStartRef.current === null) silenceStartRef.current = Date.now();
            else if (Date.now() - silenceStartRef.current > silenceTimeoutMs) {
              clearInterval(meteringTimerRef.current!); meteringTimerRef.current = null;
              const rec = recordingRef.current; recordingRef.current = null;
              await rec.stopAndUnloadAsync();
              const uri = rec.getURI();
              if (uri) await processAudio(uri);
              setActiveState('idle');
              if (!cancelledRef.current && callModeRef.current === 'vad' && !isMutedRef.current) setTimeout(startVadListening, 500);
            }
          } else { silenceStartRef.current = null; }
        } catch {}
      }, 150);
    } catch { setActiveState('idle'); }
  }

  // ─── PTT ───
  async function startPttRecording() {
    if (cancelledRef.current || activeStateRef.current !== 'idle' || isMutedRef.current || !resolvedAsrConfig.current) return;
    try {
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: false });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(RECORDING_OPTIONS);
      await recording.startAsync();
      recordingRef.current = recording;
      setActiveState('listening');
    } catch {}
  }

  async function stopPttAndProcess() {
    if (cancelledRef.current || activeStateRef.current !== 'listening' || !recordingRef.current) return;
    const rec = recordingRef.current; recordingRef.current = null;
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    if (uri) await processAudio(uri);
    setActiveState('idle');
  }

  const talkPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { Animated.timing(btnScale, { toValue: 1.12, duration: 100, useNativeDriver: true }).start(); startPttRecording(); },
    onPanResponderRelease: () => { Animated.spring(btnScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start(); stopPttAndProcess(); },
    onPanResponderTerminate: () => { Animated.spring(btnScale, { toValue: 1, friction: 4, tension: 200, useNativeDriver: true }).start(); stopPttAndProcess(); },
  })).current;

  // ─── Mode selection ───
  function handleSelectMode(mode: CallMode) {
    callModeRef.current = mode;
    setCallState('connected');
    timerRef.current = setInterval(() => { durationRef.current += 1; }, 1000);
    startRipples();
    triggerGreeting();
  }

  // ─── Greeting ───
  async function triggerGreeting() {
    let dialogue = '';
    if (apiConfigs.llm && companionId) {
      try {
        const msgs = conversationId ? await MessageRepository.getRecent(conversationId, 3) : [];
        const persona = await PersonaEngine.load(companionId);
        if (persona) {
          const ctx = msgs.length > 0 ? msgs.map(m => `${m.role === 'user' ? '用户' : persona.name}: ${m.content}`).join('\n') : '（首次通话）';
          const llm = new LLMClient(apiConfigs.llm);
          const raw = await llm.chat([
            { role: 'system', content: PromptBuilder.buildSystemPrompt(persona, 'voice_call') },
            { role: 'user', content: `[接通电话，直接从话题切入。只输出你说的话。]\n\n聊天记录:\n${ctx}` },
          ]);
          dialogue = ResponseParser.parse(raw).messages.join(' ');
        }
      } catch {}
    }
    if (!dialogue) dialogue = '喂？总算接通啦～';
    if (cancelledRef.current) return;
    setActiveState('speaking');
    addTranscript('assistant', dialogue);
    await speakText(dialogue);
    if (!cancelledRef.current) {
      setActiveState('idle');
      if (callModeRef.current === 'vad' && !isMutedRef.current) setTimeout(() => { if (!cancelledRef.current) startVadListening(); }, 500);
    }
  }

  // ─── Mute ───
  function handleMuteToggle() {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    animatePress(btnScale);
    if (newMuted) { stopRecording(); if (activeStateRef.current === 'listening') setActiveState('idle'); }
    else if (callModeRef.current === 'vad' && activeStateRef.current === 'idle' && callState === 'connected') setTimeout(() => { if (!cancelledRef.current) startVadListening(); }, 300);
  }

  // ─── Hang up ───
  async function handleHangUp() {
    Animated.parallel([Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }), Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true })]).start();
    const wasCalling = callState === 'calling' || callState === 'mode_select';
    setCallState('ended');
    if (timerRef.current) clearInterval(timerRef.current);
    if (meteringTimerRef.current) clearInterval(meteringTimerRef.current);
    await stopAudio(); await stopRecording();
    const durationStr = formatDuration(durationRef.current);
    const hadAudio = hasSpokenRef.current || hasListenedRef.current;
    const turnCount = historyRef.current.length;
    if (conversationId) {
      try {
        await MessageRepository.create({ conversationId, role: 'system', type: 'system_notification', content: wasCalling ? '📞 已取消' : `📞 语音通话结束，时长 ${durationStr}` });
        await ConversationRepository.updateLastMessage(conversationId, wasCalling ? '📞 已取消' : `📞 语音通话 ${durationStr}`);
      } catch {}
    }
    setTimeout(() => router.back(), 500);
    // Post-call summary
    if (conversationId && apiConfigs.llm && companionId && !wasCalling) {
      setTimeout(async () => {
        try {
          const persona = await PersonaEngine.load(companionId);
          if (!persona || !apiConfigs.llm) return;
          const llm = new LLMClient(apiConfigs.llm);
          if (hadAudio && turnCount > 0) {
            const historyText = historyRef.current.map(m => `${m.role === 'user' ? '用户' : persona.name}: ${m.content}`).join('\n');
            const summaryRaw = await llm.chat([{ role: 'system', content: '用一两句话总结通话内容。' }, { role: 'user', content: `时长${durationStr}，${turnCount}轮：\n${historyText}` }]);
            const summary = summaryRaw.trim();
            if (summary && summary !== '...') {
              const conv = await ConversationRepository.getByCompanionId(companionId);
              if (conv) {
                const existing = conv.longTermMemorySummary || '';
                await ConversationRepository.updateLongTermMemory(conv.id, existing ? `${existing}\n[通话 ${durationStr}] ${summary}` : `[通话 ${durationStr}] ${summary}`);
              }
            }
            const whisperRaw = await llm.chat([{ role: 'system', content: PromptBuilder.buildSystemPrompt(persona, 'chatroom') }, { role: 'user', content: `[通话结束${durationStr}，${turnCount}轮。发一条简短温暖的文字消息。]` }]);
            const whisper = ResponseParser.parse(whisperRaw).messages.join(' ');
            if (whisper && whisper !== '...') { await MessageRepository.create({ conversationId, role: 'assistant', content: whisper, emotion: 'happy' }); await ConversationRepository.updateLastAIMessage(conversationId, whisper.slice(0, 50)); }
          }
        } catch {}
      }, 8000);
    }
  }

  // ─── Status text ───
  const statusText = callState === 'calling' ? '呼叫中...'
    : callState === 'mode_select' ? '选择通话模式'
    : activeState === 'listening' ? (callModeRef.current === 'vad' ? '正在听...' : '录音中...')
    : activeState === 'thinking' ? '识别中...'
    : activeState === 'speaking' ? '通话中...'
    : isMuted ? '已静音'
    : callModeRef.current === 'vad' ? '等待说话' : '通话中';

  const breatheOpacity = breatheAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  // ─── Render ───
  return (
    <View style={styles.root}>
      <StatusBar hidden translucent backgroundColor="transparent" />

      {/* Background gradient */}
      <View style={styles.bg}>
        <View style={styles.bgLayer1} />
        <View style={styles.bgLayer2} />
        <BeamsBackground />
      </View>

      <Animated.View style={[styles.container, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>

        {/* Center area */}
        <View style={styles.centerArea}>
          {/* Ripples */}
          {callState !== 'mode_select' && rippleAnims.map((r, i) => (
            <Animated.View key={i} style={[styles.ripple, {
              width: AVATAR_SIZE * (1.15 + i * 0.2), height: AVATAR_SIZE * (1.15 + i * 0.2),
              borderRadius: AVATAR_SIZE * (0.575 + i * 0.1),
              transform: [{ scale: r.scale }], opacity: r.opacity,
            }]} />
          ))}

          {/* Avatar */}
          <Animated.View style={[styles.avatarContainer, { transform: [{ scale: pulseAnim }] }]}>
            <View style={styles.avatarGlow} />
            <View style={styles.avatarWrap}>
              <Avatar uri={companion?.avatarUri || null} name={companion?.name || '?'} size="xl" />
            </View>
            {callState !== 'mode_select' && (
              <Animated.View style={[styles.statusDot, { opacity: breatheOpacity },
                activeState === 'listening' && styles.statusDotListening,
                activeState === 'speaking' && styles.statusDotSpeaking,
              ]} />
            )}
          </Animated.View>

          {/* Name */}
          <Text style={styles.name}>{companion?.name || ''}</Text>

          {/* Status */}
          {asrWarning && callState !== 'mode_select' ? (
            <Text style={styles.warning}>{asrWarning}</Text>
          ) : (
            <View style={styles.statusRow}>
              {activeState === 'thinking' && (
                <View style={styles.dots}>
                  {[0, 1, 2].map(i => <View key={i} style={[styles.dot, { opacity: 0.4 + i * 0.2 }]} />)}
                </View>
              )}
              <Text style={styles.statusText}>{statusText}</Text>
            </View>
          )}

          {/* Duration */}
          {callState === 'connected' && (
            <Text style={styles.duration}>{formatDuration(durationRef.current)}</Text>
          )}
        </View>

        {/* Mode selection */}
        {callState === 'mode_select' && (
          <View style={styles.modeArea}>
            <Text style={styles.modeHint}>选择通话模式</Text>
            <TouchableOpacity style={styles.modeCard} onPress={() => handleSelectMode('vad')} activeOpacity={0.7}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.modeIcon}><Ionicons name="mic" size={26} color="#7C9EFF" /></View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>连续对话</Text>
                <Text style={styles.modeDesc}>像打电话一样自然，说完自动等待回复</Text>
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modeCard} onPress={() => handleSelectMode('ptt')} activeOpacity={0.7}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.modeIcon}><Ionicons name="finger-print" size={26} color="#B89AFF" /></View>
              <View style={styles.modeInfo}>
                <Text style={styles.modeName}>按住说话</Text>
                <Text style={styles.modeDesc}>按住录音，松手发送，精准控制</Text>
              </View>
            </TouchableOpacity>
            {asrWarning && <Text style={styles.modeWarning}>{asrWarning}</Text>}
          </View>
        )}

        {/* Transcript - only show user messages */}
        {callState === 'connected' && transcript.filter(t => t.role === 'user').length > 0 && (
          <View style={styles.transcriptContainer}>
            <ScrollView style={styles.transcriptScroll} contentContainerStyle={styles.transcriptContent}>
              {transcript.filter(t => t.role === 'user').map((t, i) => (
                <View key={i} style={[styles.transcriptLine, styles.transcriptUser]}>
                  <Text style={styles.transcriptTextUser}>{t.text}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Controls */}
        {callState === 'connected' && (
          <View style={styles.controls}>
            {/* Mute */}
            <TouchableOpacity style={[styles.ctrlBtn, isMuted && styles.ctrlBtnActive]} onPress={handleMuteToggle} activeOpacity={0.7}>
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={20} color="#fff" />
            </TouchableOpacity>

            {/* Main button */}
            {callModeRef.current === 'ptt' ? (
              <Animated.View style={{ transform: [{ scale: btnScale }] }}>
                <View style={[styles.mainBtn, activeState === 'listening' && styles.mainBtnActive]} {...talkPanResponder.panHandlers}>
                  <Ionicons name={activeState === 'listening' ? 'mic' : 'mic-outline'} size={30} color="#fff" />
                </View>
                <Text style={styles.mainBtnLabel}>{activeState === 'listening' ? '松手发送' : '按住说话'}</Text>
              </Animated.View>
            ) : (
              <View style={styles.vadGroup}>
                <View style={[styles.mainBtn, styles.mainBtnVad,
                  activeState === 'listening' && styles.mainBtnListening,
                  activeState === 'thinking' && styles.mainBtnThinking,
                  activeState === 'speaking' && styles.mainBtnSpeaking,
                ]}>
                  <Ionicons name={
                    activeState === 'listening' ? 'mic' :
                    activeState === 'thinking' ? 'hourglass' :
                    activeState === 'speaking' ? 'volume-high' : 'mic-outline'
                  } size={28} color="#fff" />
                </View>
                <Text style={styles.mainBtnLabel}>
                  {activeState === 'listening' ? '正在听' : activeState === 'thinking' ? '识别中' : activeState === 'speaking' ? '对方说话' : '自动对话'}
                </Text>
              </View>
            )}

            {/* Hang up */}
            <Animated.View style={{ transform: [{ scale: hangupScale }] }}>
              <TouchableOpacity style={styles.hangupBtn} onPress={() => animatePress(hangupScale)} onPressOut={handleHangUp} activeOpacity={0.7}>
                <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              </TouchableOpacity>
            </Animated.View>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  bgLayer1: { ...StyleSheet.absoluteFillObject, backgroundColor: '#1C1C2E' },
  bgLayer2: { ...StyleSheet.absoluteFillObject, backgroundColor: '#252540', opacity: 0.7 },
  bgOrb1: { position: 'absolute', width: 350, height: 350, borderRadius: 175, backgroundColor: 'rgba(168,130,255,0.1)', top: '5%', left: '-25%' },
  bgOrb2: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(120,160,255,0.08)', bottom: '15%', right: '-20%' },
  bgOrb3: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: 'rgba(200,140,255,0.06)', top: '40%', right: '10%' },
  container: { flex: 1, justifyContent: 'space-between', paddingTop: 80, paddingBottom: 50 },

  // Center
  centerArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', borderWidth: 1.5, borderColor: 'rgba(168,130,255,0.1)' },
  avatarContainer: { position: 'relative', alignItems: 'center' },
  avatarGlow: { position: 'absolute', width: AVATAR_SIZE + 44, height: AVATAR_SIZE + 44, borderRadius: (AVATAR_SIZE + 44) / 2, backgroundColor: 'rgba(168,130,255,0.15)' },
  avatarWrap: {
    width: AVATAR_SIZE, height: AVATAR_SIZE, borderRadius: AVATAR_SIZE / 2,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.25)',
    shadowColor: '#A882FF', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35, shadowRadius: 20, elevation: 10, overflow: 'hidden',
    alignItems: 'center', justifyContent: 'center',
  },
  statusDot: { position: 'absolute', bottom: 4, right: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: '#6B7280', borderWidth: 2.5, borderColor: '#1C1C2E' },
  statusDotListening: { backgroundColor: '#7C9EFF' },
  statusDotSpeaking: { backgroundColor: '#7EE8A8' },
  name: { color: '#fff', fontSize: 23, fontWeight: '600', marginTop: 22, letterSpacing: 0.3 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, gap: 6 },
  statusText: { color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: '400' },
  warning: { color: '#FCD34D', fontSize: 12, marginTop: 10, textAlign: 'center', paddingHorizontal: 40, lineHeight: 18 },
  dots: { flexDirection: 'row', gap: 3, marginRight: 4 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.5)' },
  duration: { color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 6, fontVariant: ['tabular-nums'] },

  // Mode selection
  modeArea: { paddingHorizontal: 28, gap: 14 },
  modeHint: { color: 'rgba(255,255,255,0.45)', fontSize: 13, textAlign: 'center', marginBottom: 4 },
  modeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20,
    padding: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden',
  },
  modeIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(168,130,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  modeInfo: { flex: 1 },
  modeName: { color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 3 },
  modeDesc: { color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 17 },
  modeWarning: { color: '#FCD34D', fontSize: 11, textAlign: 'center', marginTop: 4 },

  // Transcript
  transcriptContainer: { flex: 1, marginHorizontal: 20, maxHeight: 160 },
  transcriptScroll: { flex: 1 },
  transcriptContent: { gap: 6, paddingVertical: 8 },
  transcriptLine: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16 },
  transcriptUser: { alignSelf: 'flex-end', backgroundColor: 'rgba(168,130,255,0.3)', borderBottomRightRadius: 4 },
  transcriptTextUser: { color: 'rgba(255,255,255,0.92)', fontSize: 13, lineHeight: 18 },

  // Controls
  controls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 36, paddingHorizontal: 16 },
  ctrlBtn: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  ctrlBtnActive: { backgroundColor: 'rgba(255,255,255,0.2)', borderColor: 'rgba(255,255,255,0.25)' },
  mainBtn: { width: 76, height: 76, borderRadius: 38, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)' },
  mainBtnActive: { backgroundColor: 'rgba(124,158,255,0.45)', borderColor: '#7C9EFF' },
  mainBtnVad: {},
  mainBtnListening: { backgroundColor: 'rgba(124,158,255,0.4)', borderColor: '#7C9EFF' },
  mainBtnThinking: { backgroundColor: 'rgba(251,191,36,0.3)', borderColor: '#FBBF24' },
  mainBtnSpeaking: { backgroundColor: 'rgba(126,232,168,0.3)', borderColor: '#7EE8A8' },
  mainBtnLabel: { color: 'rgba(255,255,255,0.65)', fontSize: 12, textAlign: 'center', marginTop: 8, fontWeight: '500' },
  vadGroup: { alignItems: 'center' },
  hangupBtn: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF6B6B',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FF6B6B', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 14, elevation: 8,
  },
});
