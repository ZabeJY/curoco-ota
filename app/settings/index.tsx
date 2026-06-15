/**
 * Curoco — Settings (Clean)
 * Theme, memory sliders, management links, reset
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Alert, Linking, ActivityIndicator, Animated } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import * as Updates from 'expo-updates';
import { useSettingsStore } from '../../src/store/settingsStore';
import { useTheme } from '../../src/theme/ThemeProvider';
import Slider from '../../src/components/common/Slider';
import { CloudSyncService } from '../../src/core/CloudSyncService';
import { registerForPushNotifications, getStoredPushToken } from '../../src/core/PushNotificationManager';

const CURRENT_VERSION = '1.8.0';
const VERSION_UPDATE_NOTES = [
  '修复消息列表点击闪退问题',
  '修复动态卡片交互失效问题',
  '修复动态详情页无法打开问题',
  '修复版本号显示错误',
  '修复我的页面用户名误显示问题',
  '优化签名显示位置',
  '3D卡片微交互组件：TiltCard',
  '远程推送通知：Expo Push Notifications',
  '用户签名：个人资料编辑+角色感知',
  '自定义聊天背景：角色设置上传+半透明显示',
  '动态知识打通：角色感知用户Space动态',
];

export default function SettingsPage() {
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const { theme, isDark } = useTheme();

  const [memorySize, setMemorySize] = useState(settings.activeMemoryWindowSize);
  const [compressAt, setCompressAt] = useState(settings.compressionTriggerCount);
  const [typingSpeed, setTypingSpeed] = useState(settings.baseTypingSpeedMs);
  const [fullMemoryMode, setFullMemoryMode] = useState(settings.compressionTriggerCount >= 99999);
  const [vadSensitivity, setVadSensitivity] = useState(settings.vadSensitivity ?? -40);
  const [silenceTimeout, setSilenceTimeout] = useState(settings.silenceTimeoutMs ?? 1800);
  const [pushToken, setPushToken] = useState<string | null>(null);

  // Load push token on mount
  useEffect(() => {
    getStoredPushToken().then(token => {
      if (token) setPushToken(token);
    });
  }, []);

  useEffect(() => {
    setMemorySize(settings.activeMemoryWindowSize);
    setCompressAt(settings.compressionTriggerCount);
    setTypingSpeed(settings.baseTypingSpeedMs);
    setVadSensitivity(settings.vadSensitivity ?? -40);
    setSilenceTimeout(settings.silenceTimeoutMs ?? 1800);
  }, [settings]);

  function handleMemoryChange(val: number) {
    setMemorySize(val);
    if (val >= compressAt) {
      const newC = val + 10;
      setCompressAt(newC);
      updateSetting('compressionTriggerCount', newC);
    }
    updateSetting('activeMemoryWindowSize', val);
  }

  function handleCompressChange(val: number) {
    if (val <= memorySize) return;
    setCompressAt(val);
    updateSetting('compressionTriggerCount', val);
  }

  const [checking, setChecking] = useState(false);

  async function handleCheckUpdate() {
    setChecking(true);
    try {
      // Step 1: Check OTA bundle update via expo-updates
      let otaUpdated = false;
      try {
        const otaCheck = await Updates.checkForUpdateAsync();
        if (otaCheck.isAvailable) {
          const otaResult = await Updates.fetchUpdateAsync();
          if (otaResult.isNew) {
            otaUpdated = true;
            Alert.alert(
              '更新已下载',
              '新版本已准备就绪，点击重启以应用更新。',
              [{ text: '立即重启', onPress: () => Updates.reloadAsync() }]
            );
            return;
          }
        }
      } catch (e) {
        console.warn('[Update] OTA check failed:', e);
      }

      // Step 2: Check for full APK update via version.json
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const response = await fetch('https://zabejy.github.io/curoco-ota/version.json', {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await response.json();
      const remoteVersion = data.version;
      const downloadUrl = data.downloadUrl;
      const changelog = data.changelog || [];

      if (remoteVersion && remoteVersion !== CURRENT_VERSION) {
        Alert.alert(
          '发现新版本',
          `当前版本：v${CURRENT_VERSION}\n最新版本：v${remoteVersion}\n\n更新内容：\n${changelog.map((n: string, i: number) => `${i + 1}. ${n}`).join('\n')}`,
          [
            { text: '稍后', style: 'cancel' },
            downloadUrl ? { text: '下载安装包', onPress: () => Linking.openURL(downloadUrl) } : undefined,
          ].filter(Boolean) as any
        );
      } else if (!otaUpdated) {
        Alert.alert(
          '检查更新',
          `当前版本：v${CURRENT_VERSION}\n\n已是最新版本！`,
          [
            { text: '确定', style: 'default' },
            {
              text: '查看更新日志',
              onPress: () => {
                Alert.alert(
                  `v${CURRENT_VERSION} 更新内容`,
                  VERSION_UPDATE_NOTES.map((n, i) => `${i + 1}. ${n}`).join('\n'),
                );
              },
            },
          ]
        );
      }
    } catch (e) {
      console.warn('[Update] Check failed:', e);
      Alert.alert(
        '检查更新',
        `当前版本：v${CURRENT_VERSION}\n\n无法连接到更新服务器，请检查网络。`,
        [
          { text: '确定', style: 'default' },
          {
            text: '查看更新日志',
            onPress: () => {
              Alert.alert(
                `v${CURRENT_VERSION} 更新内容`,
                VERSION_UPDATE_NOTES.map((n, i) => `${i + 1}. ${n}`).join('\n'),
              );
            },
          },
        ]
      );
    } finally {
      setChecking(false);
    }
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bgPrimary }]} showsVerticalScrollIndicator={false}>

      {/* Profile */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>个人资料</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/user-profile')} activeOpacity={0.6}>
          <Ionicons name="person-outline" size={20} color={theme.primary} />
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>编辑个人资料</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Memory Mode Selection — premium glass aesthetic */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>记忆共振模式</Text>
      <View style={styles.memoryCardWrap}>
        <TouchableOpacity
          style={[
            styles.memoryOptionNew,
            {
              backgroundColor: !fullMemoryMode ? `${theme.primary}10` : theme.bgSecondary,
              borderColor: !fullMemoryMode ? `${theme.primary}30` : theme.border,
            },
          ]}
          onPress={() => {
            setFullMemoryMode(false);
            setCompressAt(120);
            updateSetting('compressionTriggerCount', 120);
          }}
          activeOpacity={0.7}
        >
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.memoryOptionHeader}>
            <View style={[styles.memoryIconWrap, { backgroundColor: !fullMemoryMode ? `${theme.primary}18` : theme.bgTertiary }]}>
              <Ionicons name="flash" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.memoryOptionTitle, { color: theme.textPrimary }]}>
                常态默契
              </Text>
              {!fullMemoryMode && (
                <View style={styles.memoryCheckRow}>
                  <Ionicons name="checkmark-circle" size={13} color={theme.primary} />
                  <Text style={[styles.memoryCheckText, { color: theme.primary }]}>当前模式</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.memoryOptionDesc, { color: theme.textSecondary }]}>
            漏斗记忆机制，保留最近20条短时对话，远期故事提炼为长时默契。思维最敏捷、响应最即时。
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.memoryOptionNew,
            {
              backgroundColor: fullMemoryMode ? `${theme.primary}10` : theme.bgSecondary,
              borderColor: fullMemoryMode ? `${theme.primary}30` : theme.border,
            },
          ]}
          onPress={() => {
            setFullMemoryMode(true);
            setCompressAt(99999);
            updateSetting('compressionTriggerCount', 99999);
          }}
          activeOpacity={0.7}
        >
          <BlurView intensity={30} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <View style={styles.memoryOptionHeader}>
            <View style={[styles.memoryIconWrap, { backgroundColor: fullMemoryMode ? `${theme.primary}18` : theme.bgTertiary }]}>
              <Ionicons name="library" size={18} color={theme.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.memoryOptionTitle, { color: theme.textPrimary }]}>
                完整回溯
              </Text>
              {fullMemoryMode && (
                <View style={styles.memoryCheckRow}>
                  <Ionicons name="checkmark-circle" size={13} color={theme.primary} />
                  <Text style={[styles.memoryCheckText, { color: theme.primary }]}>当前模式</Text>
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.memoryOptionDesc, { color: theme.textSecondary }]}>
            无限制历史长河。不进行记忆压缩，完全保留自相识以来的每一个字。检索量大时可能有轻微延迟。
          </Text>
        </TouchableOpacity>
      </View>

      {/* Push Notifications */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>推送通知</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <InfoRow label="状态" value={pushToken ? '已启用' : '未启用'} theme={theme} />
        <InfoRow label="说明" value="即使关闭App也能收到AI的消息提醒" theme={theme} />
        <TouchableOpacity style={styles.row} onPress={async () => {
          if (pushToken) {
            Alert.alert('推送已启用', `Token: ${pushToken.slice(0, 30)}...`);
          } else {
            const token = await registerForPushNotifications();
            if (token) {
              setPushToken(token);
              Alert.alert('推送已启用', '现在即使关闭App也能收到消息提醒');
            } else {
              Alert.alert('启用失败', '请检查通知权限设置');
            }
          }
        }} activeOpacity={0.6}>
          <Ionicons name={pushToken ? 'checkmark-circle' : 'notifications-outline'} size={20} color={pushToken ? '#2ED573' : theme.primary} />
          <Text style={[styles.rowLabel, { color: theme.primary }]}>{pushToken ? '推送已启用' : '启用推送通知'}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Chat */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>聊天</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.sliderSection}>
          <Slider
            value={typingSpeed} min={50} max={400} step={25}
            onChange={(v) => setTypingSpeed(v)}
            onSlidingComplete={(v) => { updateSetting('baseTypingSpeedMs', v); }}
            trackColor={theme.primary} thumbColor={theme.primary}
            label="打字速度" unit="ms/字"
          />
          <Text style={[styles.hint, { color: theme.textTertiary }]}>
            AI 回复时的打字间隔。推荐 100-150ms，接近真人节奏。
          </Text>
        </View>
      </View>

      {/* Voice Call */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>语音通话</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.sliderSection}>
          <Slider
            value={Math.abs(vadSensitivity)} min={20} max={60} step={5}
            onChange={(v) => setVadSensitivity(-v)}
            onSlidingComplete={(v) => { updateSetting('vadSensitivity', -v); }}
            trackColor={theme.primary} thumbColor={theme.primary}
            label="VAD 灵敏度" unit="dB"
          />
          <Text style={[styles.hint, { color: theme.textTertiary }]}>
            静默检测阈值。值越小越灵敏（-20=很灵敏，-60=不灵敏）。推荐 -35 到 -45。
          </Text>
        </View>
        <View style={[styles.sliderSection, { marginTop: 16 }]}>
          <Slider
            value={silenceTimeout} min={800} max={5000} step={200}
            onChange={(v) => setSilenceTimeout(v)}
            onSlidingComplete={(v) => { updateSetting('silenceTimeoutMs', v); }}
            trackColor={theme.primary} thumbColor={theme.primary}
            label="静音超时" unit="ms"
          />
          <Text style={[styles.hint, { color: theme.textTertiary }]}>
            说完后多久自动发送。值越小响应越快（800ms=快速，3000ms=等你说完）。推荐 1500-2500ms。
          </Text>
        </View>
      </View>

      {/* Management */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>管理</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <LinkRow icon="key-outline" label="API 配置" theme={theme} onPress={() => router.push('/settings/api-config')} />
        <LinkRow icon="mic-outline" label="音色克隆" theme={theme} onPress={() => router.push('/settings/voice-clone')} />
        <LinkRow icon="bulb-outline" label="记忆管理" theme={theme} onPress={() => router.push('/settings/memory')} />
        <LinkRow icon="notifications-outline" label="互动与通知" theme={theme} onPress={() => router.push('/settings/notifications')} />
        <LinkRow icon="happy-outline" label="表情包管理" theme={theme} onPress={() => router.push('/settings/stickers')} />
      </View>

      {/* Cloud Sync */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>数据备份</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <TouchableOpacity style={styles.row} onPress={async () => {
          Alert.alert('导出数据', '将导出所有聊天记录、角色、设置等数据到文件，可用于备份或迁移到其他设备。', [
            { text: '取消', style: 'cancel' },
            { text: '导出', onPress: async () => {
              const result = await CloudSyncService.exportData();
              if (!result.success && result.error !== '已取消') {
                Alert.alert('导出失败', result.error);
              }
            }},
          ]);
        }} activeOpacity={0.6}>
          <Ionicons name="cloud-upload-outline" size={20} color={theme.primary} />
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>导出数据备份</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={async () => {
          Alert.alert('导入数据', '将从备份文件恢复所有数据。当前数据会被覆盖，此操作不可撤销！', [
            { text: '取消', style: 'cancel' },
            { text: '导入', style: 'destructive', onPress: async () => {
              const result = await CloudSyncService.importData();
              if (result.success) {
                Alert.alert('导入成功', `已导入 ${result.imported?.companions || 0} 个角色，${result.imported?.messages || 0} 条消息。\n请重新启动应用以加载数据。`);
              } else if (result.error !== '已取消') {
                Alert.alert('导入失败', result.error);
              }
            }},
          ]);
        }} activeOpacity={0.6}>
          <Ionicons name="cloud-download-outline" size={20} color="#FF9500" />
          <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>从备份恢复</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Reset */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>危险操作</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <TouchableOpacity style={styles.row} onPress={() => {
          Alert.alert('重置应用', '将清空所有数据（聊天记录、记忆、设置）并恢复出厂状态。此操作不可撤销！', [
            { text: '取消', style: 'cancel' },
            { text: '重置', style: 'destructive', onPress: async () => {
              try {
                const { closeDatabase } = require('../../src/db/index');
                const FS = require('expo-file-system');
                await closeDatabase();
                await FS.deleteAsync(FS.documentDirectory + 'SQLite/curoco.db', { idempotent: true });
                Alert.alert('已重置', '请重新启动应用');
              } catch { Alert.alert('重置失败'); }
            }},
          ]);
        }}>
          <Ionicons name="refresh-outline" size={20} color="#FF4757" />
          <Text style={[styles.rowLabel, { color: '#FF4757' }]}>重置应用</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* About */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>关于</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.aboutLogoRow}>
          <Text style={[styles.aboutName, { color: theme.textPrimary }]}>Curoco</Text>
        </View>
        <InfoRow label="版本" value={`v${CURRENT_VERSION}`} theme={theme} />
        <InfoRow label="项目" value="Curoco AI Companion" theme={theme} />
        <TouchableOpacity style={styles.row} onPress={handleCheckUpdate} activeOpacity={0.6} disabled={checking}>
          {checking ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Ionicons name="cloud-download-outline" size={20} color={theme.primary} />
          )}
          <Text style={[styles.rowLabel, { color: theme.primary }]}>{checking ? '检查中...' : '检查更新'}</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Legal */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>法律信息</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <LinkRow icon="document-text-outline" label="责任边界声明" theme={theme} onPress={() => {
          Alert.alert('责任边界声明', 'Curoco 责任边界声明\n\n1. 本软件仅为第三方AI大模型API接入客户端工具，不内置任何AI大模型服务，不提供AI生成能力，所有AI对话生成均由用户自行配置的第三方API服务商完成。\n\n2. 软件开发者不对第三方AI服务的可用性、准确性、安全性承担任何责任。\n\n3. 用户通过本软件生成的所有内容（包括但不限于对话、图片、语音）均由对应的第三方AI服务商处理和生成，相关责任由对应服务商及用户自行承担。\n\n4. 软件开发者不对用户使用本软件所产生的任何直接或间接后果承担责任。');
        }} />
        <LinkRow icon="shield-checkmark-outline" label="隐私声明" theme={theme} onPress={() => {
          Alert.alert('隐私声明', 'Curoco 隐私声明\n\n1. 数据本地存储\n本软件无账户系统、无后端服务器。所有对话记录、API密钥、用户配置全部存储在用户本地设备，开发者无法获取。\n\n2. 联网功能说明\n本软件仅有两项联网功能：\n① 检查版本更新 — 仅请求版本号，不收集用户信息\n② 表情包关键词搜索 — 仅上传搜索关键词，不上传其他本地数据\n\n3. 用户数据处置权利\n用户可随时在设置中清除所有本地数据，包括聊天记录、角色配置、API密钥等。卸载应用将删除所有数据。\n\n4. 第三方API调用\n当用户配置并使用AI对话功能时，消息内容会发送至用户自行配置的第三方API服务商进行处理。数据传输由对应服务商的隐私政策管辖。');
        }} />
        <LinkRow icon="warning-outline" label="免责与使用约束" theme={theme} onPress={() => {
          Alert.alert('免责与使用约束', 'Curoco 免责与使用约束\n\n1. 非商用属性\n本软件为个人学习交流作品，仅限非商用场景使用。\n\n2. 禁止违法使用\n用户不得利用本软件从事违法违规活动，包括但不限于：生成违法内容、侵犯他人权益、进行欺诈活动等。\n\n3. 使用风险自担\n用户使用本软件产生的一切风险和后果由用户自行承担。AI生成内容可能不准确或存在偏见，请用户理性看待。\n\n4. 未成年人保护\n未满18周岁的用户应在监护人指导下使用本软件。\n\n5. 服务变更\n软件开发者保留随时修改、暂停或终止本软件服务的权利，恕不另行通知。');
        }} />
      </View>

      {/* Donate */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>支持我们</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <TouchableOpacity style={styles.row} onPress={() => router.push('/settings/donate')} activeOpacity={0.6}>
          <Ionicons name="heart-outline" size={20} color="#FF6B6B" />
          <Text style={[styles.rowLabel, { color: '#FF6B6B' }]}>支持一下开发者</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Version update notes */}
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>v{CURRENT_VERSION} 更新内容</Text>
      <View style={[styles.card, { backgroundColor: theme.bgSecondary }]}>
        <View style={styles.updateNotes}>
          {VERSION_UPDATE_NOTES.map((note, i) => (
            <View key={i} style={styles.updateNoteRow}>
              <Ionicons name="checkmark-circle" size={14} color="#2ED573" />
              <Text style={[styles.updateNoteText, { color: theme.textPrimary }]}>{note}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

function LinkRow({ icon, label, theme, onPress }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon} size={20} color={theme.textPrimary} />
      <Text style={[styles.rowLabel, { color: theme.textPrimary }]}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={theme.textTertiary} />
    </TouchableOpacity>
  );
}

function InfoRow({ label, value, theme }: any) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textPrimary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.textSecondary }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionTitle: { fontSize: 12, fontWeight: '600', paddingHorizontal: 20, paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: '#FFFFFF', marginHorizontal: 16, borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F2', gap: 10 },
  rowLabel: { flex: 1, fontSize: 15 },
  sliderSection: { paddingHorizontal: 16, paddingVertical: 12 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  hint: { fontSize: 12, lineHeight: 18, marginTop: 8 },
  warnRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  warnText: { fontSize: 12, color: '#FF4757' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F2' },
  infoLabel: { fontSize: 15 },
  infoValue: { fontSize: 14 },
  updateNotes: { padding: 16, gap: 10 },
  updateNoteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  updateNoteText: { fontSize: 13, lineHeight: 18, flex: 1 },
  aboutLogoRow: { paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#F0F0F2' },
  aboutName: { fontSize: 20, fontWeight: '800', letterSpacing: 1.5 },
  toggleRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  toggle: {
    width: 44, height: 26, borderRadius: 13, backgroundColor: '#E0E0E0',
    padding: 3, justifyContent: 'center',
  },
  toggleKnob: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
  },
  // Memory Mode Selection — premium glass
  memoryCardWrap: {
    marginHorizontal: 16, gap: 12,
  },
  memoryOptionNew: {
    paddingHorizontal: 18, paddingVertical: 18,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
  },
  memoryOptionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10,
  },
  memoryIconWrap: {
    width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  memoryOptionTitle: {
    fontSize: 15, fontWeight: '600',
  },
  memoryOptionDesc: {
    fontSize: 13, lineHeight: 20, letterSpacing: 0.2,
  },
  memoryCheckRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2,
  },
  memoryCheckText: {
    fontSize: 12, fontWeight: '500',
  },
});
