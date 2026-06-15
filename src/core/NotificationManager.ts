/**
 * Curoco — Notification Manager
 * System notifications, channels, deep linking
 * Now includes push notification support for background/killed app
 */

import { Platform, AppState } from 'react-native';
import { sendPushToUser, getStoredPushToken } from './PushNotificationManager';

export interface NotificationPayload {
  type: 'chat_message' | 'ai_dynamic' | 'voice_call' | 'system';
  companionId?: string;
  companionName?: string;
  conversationId?: string;
  postId?: string;
  message?: string;
  route?: string;
}

// Channel IDs
export const CHANNELS = {
  CHAT: 'curoco_chat',
  DYNAMIC: 'curoco_dynamic',
  VOICE_CALL: 'curoco_voice_call',
} as const;

/**
 * Initialize notification channels (Android)
 */
export async function initNotificationChannels(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    // Use expo-notifications if available
    const Notifications = require('expo-notifications');

    await Notifications.setNotificationChannelAsync(CHANNELS.CHAT, {
      name: '聊天消息',
      importance: Notifications.AndroidImportance?.DEFAULT || 3,
      sound: 'default',
      vibrationPattern: [0, 250],
      lightColor: '#6C63FF',
    });

    await Notifications.setNotificationChannelAsync(CHANNELS.DYNAMIC, {
      name: '动态提醒',
      importance: Notifications.AndroidImportance?.DEFAULT || 3,
      sound: 'default',
      vibrationPattern: [0, 150],
      lightColor: '#FF9500',
    });

    await Notifications.setNotificationChannelAsync(CHANNELS.VOICE_CALL, {
      name: '伴侣来电',
      importance: Notifications.AndroidImportance?.HIGH || 4,
      sound: 'default',
      vibrationPattern: [0, 500, 200, 500],
      lightColor: '#FF4757',
    });
  } catch (e) {
    console.warn('Notification channels setup skipped:', e);
  }
}

/**
 * Request notification permissions
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const Notifications = require('expo-notifications');
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Send a local notification
 */
export async function sendNotification(payload: NotificationPayload): Promise<void> {
  try {
    const Notifications = require('expo-notifications');

    let channelId: string = CHANNELS.CHAT;
    let title = 'Curoco';
    let body = payload.message || '';

    switch (payload.type) {
      case 'chat_message':
        channelId = CHANNELS.CHAT;
        title = payload.companionName || '角色';
        body = payload.message || '发来了一条新消息';
        break;
      case 'ai_dynamic':
        channelId = CHANNELS.DYNAMIC;
        title = payload.companionName || '角色';
        body = `刚刚更新了动态：${payload.message?.slice(0, 50) || ''}`;
        break;
      case 'voice_call':
        channelId = CHANNELS.VOICE_CALL;
        title = `${payload.companionName || '角色'} 来电`;
        body = '点击接听语音通话';
        break;
      case 'system':
        title = 'Curoco';
        body = payload.message || '';
        break;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: payload,
        sound: 'default',
        ...(Platform.OS === 'android' ? { channelId } : {}),
      },
      trigger: null, // Immediate
    });

    // Also send push notification if app is in background (for true remote push)
    const appState = AppState.currentState;
    if (appState === 'background' || appState === 'inactive') {
      try {
        await sendPushToUser(title, body, payload as any);
      } catch (e) {
        // Push notification is best-effort, don't fail if it doesn't work
      }
    }
  } catch (e) {
    console.warn('Send notification failed:', e);
  }
}

/**
 * Set up notification response handler (tap on notification)
 */
export function setupNotificationHandler(
  onNotificationTapped: (payload: NotificationPayload) => void
): () => void {
  try {
    const Notifications = require('expo-notifications');

    const sub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data;
      if (data) {
        onNotificationTapped(data as NotificationPayload);
      }
    });

    return () => sub?.remove?.();
  } catch {
    return () => {};
  }
}
