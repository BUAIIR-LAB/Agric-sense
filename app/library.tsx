import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppContext } from '@/context/AppContext';
import { useSweetAlert } from '@/components/AlertProvider';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonLoader';
import { palette } from '@/theme/colors';
import { spacing } from '@/theme/spacing';
import apiService from '@/services/api';

import { appFont, Fonts } from '@/theme/fonts';

type Conversation = {
  conversation_id: string;
  created_at?: string;
  updated_at?: string;
  last_message?: string;
  message_count?: number;
};

export default function LibraryScreen() {
  const router = useRouter();
  const { state } = useAppContext();
  const { showAlert } = useSweetAlert();
  const { isReady } = useAuthGuard();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!state.isAuthenticated || !state.profile?.id) {
      setError('Please log in to view conversations');
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      const data = await apiService.getConversations(state.profile.id);

      // Handle API response format
      // Response format: {"conversations": [{"id": "...", "created_at": "...", "updated_at": "...", "metadata": {...}, "message_count": ...}, ...]}
      let conversationsList: Conversation[] = [];

      if (Array.isArray(data)) {
        conversationsList = data.map((conv: any) => {
          // Extract conversation details from the API response
          const metadata = conv.metadata || {};
          return {
            conversation_id: conv.id || conv.conversation_id || conv,
            created_at: conv.created_at,
            updated_at: conv.updated_at || conv.last_activity || metadata.last_activity,
            last_message: metadata.last_assistant_message || metadata.last_user_message || conv.last_message,
            message_count: conv.message_count || metadata.total_messages || 0,
          };
        });
      }

      // Sort by updated_at or created_at (most recent first)
      conversationsList.sort((a, b) => {
        const dateA = a.updated_at || a.created_at || '';
        const dateB = b.updated_at || b.created_at || '';

        // Convert to timestamps for proper comparison
        // Most recent (larger timestamp) should come first
        try {
          const timeA = dateA ? new Date(dateA).getTime() : 0;
          const timeB = dateB ? new Date(dateB).getTime() : 0;
          return timeB - timeA; // Descending order (newest first)
        } catch {
          // Fallback to string comparison if date parsing fails
          return dateB.localeCompare(dateA);
        }
      });

      setConversations(conversationsList);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      setError(error.message || 'Failed to load conversations');
      showAlert('error', 'Error', 'Failed to load conversations. Please try again.');
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [state.profile?.id, showAlert]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown date';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        return 'Today';
      } else if (days === 1) {
        return 'Yesterday';
      } else if (days < 7) {
        return `${days} days ago`;
      } else {
        return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
      }
    } catch {
      return 'Unknown date';
    }
  };

  const handleConversationPress = (conversationId: string) => {
    // Navigate to chat screen with conversation ID
    // The chat screen should load this conversation
    router.push({
      pathname: '/(tabs)/chat',
      params: { conversationId },
    } as any);
  };

  const renderHeader = () => (
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable
        accessibilityLabel="Go back"
        onPress={() => router.back()}
        style={styles.backButton}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={palette.text.primary} />
      </Pressable>
      <Text style={styles.headerTitle}>Conversations</Text>
      <View style={styles.headerSpacer} />
    </View>
  );

  const renderConversation = ({ item }: { item: Conversation }) => {
    const shortId = item.conversation_id.length > 12
      ? `${item.conversation_id.substring(0, 8)}...`
      : item.conversation_id;

    return (
      <Pressable
        style={styles.conversationCard}
        onPress={() => handleConversationPress(item.conversation_id)}
      >
        <View style={styles.conversationIcon}>
          <MaterialCommunityIcons name="message-text" size={24} color={palette.brandGreen} />
        </View>
        <View style={styles.conversationContent}>
          <View style={styles.conversationHeader}>
            <Text style={styles.conversationId} numberOfLines={1}>
              Conversation {shortId}
            </Text>
            <Text style={styles.conversationDate}>
              {formatDate(item.updated_at || item.created_at)}
            </Text>
          </View>
          {item.last_message && (
            <Text style={styles.conversationPreview} numberOfLines={2}>
              {item.last_message}
            </Text>
          )}
          {item.message_count !== undefined && item.message_count > 0 && (
            <Text style={styles.messageCount}>
              {item.message_count} {item.message_count === 1 ? 'message' : 'messages'}
            </Text>
          )}
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={palette.text.tertiary} />
      </Pressable>
    );
  };

  if (!isReady) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={palette.brandGreen} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={conversations}
        keyExtractor={(item: Conversation) => item.conversation_id}
        renderItem={({ item }: { item: Conversation }) => renderConversation({ item })}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.emptyContainer}>
              {[...Array(3)].map((_, i) => (
                <SkeletonCard key={i} />
              ))}
            </View>
          ) : error ? (
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="alert-circle"
                title="Error"
                message={error}
              />
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <EmptyState
                icon="message-text-outline"
                title="No Conversations"
                message="You haven't started any conversations yet. Start chatting to see them here."
              />
            </View>
          )
        }
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.brandGreen}
            colors={[palette.brandGreen]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: palette.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.gray200 || '#E5E5E5',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  headerTitle: {
    fontFamily: appFont,
    fontSize: 20,
    fontWeight: '700',
    color: palette.charcoal,
    marginLeft: 12,
  },
  headerSpacer: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: palette.gray200 || '#E5E5E5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  conversationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F5E9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  conversationContent: {
    flex: 1,
    gap: 4,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationId: {
    fontFamily: appFont,
    fontSize: 16,
    fontWeight: '600',
    color: palette.charcoal,
    flex: 1,
  },
  conversationDate: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.gray500,
    marginLeft: 8,
  },
  conversationPreview: {
    fontFamily: appFont,
    fontSize: 14,
    color: palette.gray500,
    lineHeight: 20,
  },
  messageCount: {
    fontFamily: appFont,
    fontSize: 12,
    color: palette.brandGreen,
    fontWeight: '500',
    marginTop: 2,
  },
  emptyContainer: {
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
});

