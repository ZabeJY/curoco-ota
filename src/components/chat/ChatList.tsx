/**
 * Curoco — Chat List Item (Redesigned)
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Avatar from '../common/Avatar';
import Badge from '../common/Badge';
import { useTheme } from '../../theme/ThemeProvider';
import { formatWeChatTime } from '../../utils/timestamp';

interface ChatListItemProps {
  companionName: string;
  avatarUri?: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  onPress: () => void;
}

export default function ChatListItem({
  companionName, avatarUri, lastMessage, lastMessageAt, unreadCount, onPress,
}: ChatListItemProps) {
  const { theme } = useTheme();

  return (
    <TouchableOpacity style={[styles.container, { backgroundColor: theme.bgSecondary }]} onPress={onPress} activeOpacity={0.6}>
      <Avatar uri={avatarUri} name={companionName} size="md" />
      <View style={[styles.content, { borderBottomColor: theme.divider }]}>
        <View style={styles.topRow}>
          <Text style={[styles.name, { color: theme.textPrimary }]} numberOfLines={1}>{companionName}</Text>
          <Text style={[styles.time, { color: theme.textTertiary }]}>{formatWeChatTime(lastMessageAt)}</Text>
        </View>
        <View style={styles.bottomRow}>
          <Text style={[styles.preview, { color: theme.textSecondary }]} numberOfLines={1}>{lastMessage || '暂无消息'}</Text>
          <Badge count={unreadCount} />
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    marginLeft: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F0F8',
    paddingBottom: 13,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A2E',
    flex: 1,
    marginRight: 8,
  },
  time: { fontSize: 11, color: '#A0A0B8' },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  preview: {
    fontSize: 13,
    color: '#6B6B8D',
    flex: 1,
    marginRight: 8,
  },
});
