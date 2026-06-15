/**
 * Curoco — Push Notification Manager
 * Handles remote push notifications via Expo Push Notifications
 * Free tier: unlimited notifications, no server needed
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { getDatabase } from '../db';

// Expo Push API endpoint
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Store push token in database
async function storePushToken(token: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
    ['pushToken', token]
  );
}

// Get stored push token
async function getStoredPushToken(): Promise<string | null> {
  try {
    const db = await getDatabase();
    const row = await db.getFirstAsync<any>('SELECT value FROM settings WHERE key = ?', ['pushToken']);
    return row?.value || null;
  } catch {
    return null;
  }
}

/**
 * Register for push notifications and get token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check existing permission
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('[Push] Notification permission not granted');
      return null;
    }

    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync();
    const pushToken = tokenData.data;

    // Store in database
    await storePushToken(pushToken);

    // Android-specific: set notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: '默认通知',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250],
        lightColor: '#6C63FF',
      });
    }

    console.log('[Push] Registered:', pushToken);
    return pushToken;
  } catch (e) {
    console.warn('[Push] Registration failed:', e);
    return null;
  }
}

/**
 * Send push notification via Expo Push API
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<boolean> {
  try {
    const message = {
      to: pushToken,
      title,
      body,
      data,
      sound: 'default',
      priority: 'high',
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data?.status === 'ok') {
      return true;
    }

    if (result.data?.message) {
      console.warn('[Push] Send error:', result.data.message);
    }

    return false;
  } catch (e) {
    console.warn('[Push] Send failed:', e);
    return false;
  }
}

/**
 * Send push notification to user's device
 */
export async function sendPushToUser(
  title: string,
  body: string,
  data: Record<string, any> = {}
): Promise<void> {
  const pushToken = await getStoredPushToken();
  if (!pushToken) return;

  await sendPushNotification(pushToken, title, body, data);
}

/**
 * Get stored push token
 */
export { getStoredPushToken };
