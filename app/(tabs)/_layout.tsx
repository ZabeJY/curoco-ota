/**
 * Curoco — Tab Layout (Theme-aware)
 * Floating glass tab bar with rounded corners
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../src/theme/ThemeProvider';

export default function TabLayout() {
  const { theme, isDark } = useTheme();

  const tint = isDark ? 'dark' : 'light';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textTertiary,
        tabBarStyle: {
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
          // Floating effect
          marginHorizontal: 16,
          marginBottom: 10,
          borderRadius: 24,
          position: 'absolute',
          // Shadow for floating feel
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
        },
        tabBarBackground: () => (
          <View style={StyleSheet.absoluteFill}>
            <BlurView
              intensity={isDark ? 60 : 80}
              tint={tint}
              style={[StyleSheet.absoluteFill, styles.blurContainer]}
            />
            {/* Glass border overlay */}
            <View style={[
              StyleSheet.absoluteFill,
              styles.glassBorder,
              { borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.4)' },
            ]} />
          </View>
        ),
        tabBarLabelStyle: { fontSize: 10, fontWeight: '500' },
        headerStyle: { backgroundColor: theme.bgPrimary },
        headerTitleStyle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '消息',
          headerTitle: '消息',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)' },
          tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-ellipses" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="contacts"
        options={{
          title: '角色',
          headerTitle: '角色',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)' },
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="discover"
        options={{
          title: '动态',
          headerTitle: 'Curoco Space',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)' },
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: '我的',
          headerTitle: '我的',
          headerTransparent: true,
          headerStyle: { backgroundColor: 'transparent' },
          headerTitleStyle: { fontSize: 18, fontWeight: '700', color: isDark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)' },
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  blurContainer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  glassBorder: {
    borderRadius: 24,
    borderWidth: 0.5,
  },
});
