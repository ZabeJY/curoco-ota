/**
 * Curoco — Root Layout
 * ThemeProvider wrapping + initialization + splash screen
 */

import React, { useEffect, useState, useRef } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { getDatabase } from '../src/db/index';
import { useSettingsStore } from '../src/store/settingsStore';
import { ThemeProvider, useTheme } from '../src/theme/ThemeProvider';
import { proactiveManager } from '../src/core/ProactiveManager';
import { initNotificationChannels, requestNotificationPermission, setupNotificationHandler } from '../src/core/NotificationManager';
import { registerBackgroundTask } from '../src/core/BackgroundTaskManager';
import { registerForPushNotifications } from '../src/core/PushNotificationManager';
import UpdateModal from '../src/components/common/UpdateModal';
import AnimatedSplash from '../src/components/common/AnimatedSplash';
import * as Updates from 'expo-updates';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

// Keep splash screen visible while initializing
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const router = useRouter();
  const { loadSettings, loadApiConfigs } = useSettingsStore();
  const [appReady, setAppReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);
  const splashDoneRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        await getDatabase();
        await loadSettings();
        await loadApiConfigs();

        // Initialize notifications
        try {
          await initNotificationChannels();
          // Configure foreground notification display
          Notifications.setNotificationHandler({
            handleNotification: async () => ({
              shouldShowAlert: true,
              shouldPlaySound: true,
              shouldSetBadge: true,
            }),
          });
          // Auto-request permission on first launch
          const hasAsked = await getDatabase().then(db =>
            db.getFirstAsync('SELECT value FROM settings WHERE key = ?', ['notif_permission_asked'])
          );
          if (!hasAsked) {
            await requestNotificationPermission();
            await getDatabase().then(db =>
              db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['notif_permission_asked', 'true'])
            );
          }
        } catch (e) {
          console.warn('Notification init skipped:', e);
        }

        // Register background task
        try {
          await registerBackgroundTask();
        } catch (e) {
          console.warn('Background task registration skipped:', e);
        }

        // Register for push notifications
        try {
          await registerForPushNotifications();
        } catch (e) {
          console.warn('Push notification registration skipped:', e);
        }
      } catch (e) {
        console.warn('Init failed:', e);
      } finally {
        setAppReady(true);
        // Hide native splash and show animated splash
        setTimeout(() => {
          SplashScreen.hideAsync().catch(() => {});
        }, 300);

        // Silent OTA check: fetch update in background, apply on next reload
        Updates.checkForUpdateAsync()
          .then((result) => {
            if (result.isAvailable) {
              Updates.fetchUpdateAsync().catch(() => {});
            }
          })
          .catch(() => {});
      }
    })();
  }, []);

  // Safety timeout: force hide animated splash after 5 seconds, only once
  useEffect(() => {
    if (!appReady || splashDoneRef.current) return;
    const timer = setTimeout(() => {
      if (!splashDoneRef.current) {
        splashDoneRef.current = true;
        setShowAnimatedSplash(false);
      }
    }, 5000);
    return () => clearTimeout(timer);
  }, [appReady]);

  // Start proactive message manager
  const { apiConfigs } = useSettingsStore();
  useEffect(() => {
    if (apiConfigs.llm) {
      proactiveManager.start(apiConfigs.llm, apiConfigs.vision, apiConfigs.tts);
    }
    return () => proactiveManager.stop();
  }, [apiConfigs.llm, apiConfigs.vision, apiConfigs.tts]);

  // Setup notification tap handler
  useEffect(() => {
    const cleanup = setupNotificationHandler((payload) => {
      console.log('Notification tapped:', payload);
      // Navigate based on notification type
      if (payload.type === 'chat_message' && payload.conversationId) {
        // Navigate to chat page
        router.push(`/chat/${payload.conversationId}`);
      } else if (payload.type === 'ai_dynamic') {
        // Navigate to discover page
        router.push('/(tabs)/discover');
      } else if (payload.type === 'voice_call' && payload.conversationId) {
        // Navigate to chat page for voice call
        router.push(`/chat/${payload.conversationId}`);
      }
    });
    return cleanup;
  }, []);

  function handleSplashComplete() {
    if (!splashDoneRef.current) {
      splashDoneRef.current = true;
      setShowAnimatedSplash(false);
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AnimatedSplash
          visible={showAnimatedSplash && appReady}
          onAnimationComplete={handleSplashComplete}
        />
        <RootNavigator />
        <UpdateModal />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

function RootNavigator() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar style={theme.bgPrimary === '#0D0D14' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.bgPrimary },
          headerTintColor: theme.textPrimary,
          headerTitleStyle: { fontWeight: '600', fontSize: 17, color: theme.textPrimary },
          contentStyle: { backgroundColor: theme.bgPrimary },
          headerShadowVisible: false,
          gestureEnabled: true,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="chat/[id]" options={{ title: '聊天', headerBackTitle: '返回', gestureEnabled: true }} />
        <Stack.Screen name="call/[id]" options={{ title: '语音通话', headerShown: false, presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="companion/create" options={{ title: '创建角色', presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="companion/[id]/index" options={{ title: '角色详情', headerBackTitle: '返回' }} />
        <Stack.Screen name="companion/[id]/persona" options={{ title: '编辑人设', headerBackTitle: '返回' }} />
        <Stack.Screen name="companion/[id]/edit" options={{ title: '编辑角色', headerBackTitle: '返回' }} />
        <Stack.Screen name="companion/[id]/settings" options={{ title: '角色设置', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/index" options={{ title: '设置', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/api-config" options={{ title: 'API 配置', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/voice-clone" options={{ title: '音色克隆', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/memory" options={{ title: '记忆管理', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/notifications" options={{ title: '互动与通知', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/stickers" options={{ title: '表情包管理', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/user-profile" options={{ title: '个人信息', headerBackTitle: '返回' }} />
        <Stack.Screen name="settings/donate" options={{ title: '支持开发者', headerBackTitle: '返回' }} />
        <Stack.Screen name="post/[id]" options={{ headerShown: false, animation: 'slide_from_right' }} />
      </Stack>
    </>
  );
}
