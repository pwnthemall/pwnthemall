import { useEffect, useState, useCallback, useRef } from 'react';
import { TeamChatMessage, TeamChatMessageInput, TeamChatMessagesResponse } from '@/models/TeamChat';
import axios from '@/lib/axios';
import { debugLog, debugError } from '@/lib/debug';
import { useRealtimeUpdates, UpdateEvent } from './use-realtime-updates';

interface UseTeamChatReturn {
  messages: TeamChatMessage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalMessages: number;
  sendMessage: (input: TeamChatMessageInput) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  refreshMessages: () => Promise<void>;
}

export function useTeamChat(teamId: number | null): UseTeamChatReturn {
  const [messages, setMessages] = useState<TeamChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalMessages, setTotalMessages] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = useCallback(async (cursor?: number, append: boolean = false) => {
    if (!teamId) return;

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (cursor) params.append('cursor', cursor.toString());

      const response = await axios.get<TeamChatMessagesResponse>(
        `/api/teams/${teamId}/chat/messages?${params.toString()}`
      );

      if (append) {
        // Prepend older messages (for pagination)
        setMessages(prev => [...response.data.messages, ...prev]);
      } else {
        // Initial load or refresh
        setMessages(response.data.messages);
      }

      setHasMore(response.data.hasMore);
      setNextCursor(response.data.nextCursor);
      setTotalMessages(response.data.totalMessages);
    } catch (err: any) {
      debugError('Failed to fetch team chat messages:', err);
      setError(err.response?.data?.error || 'Failed to fetch messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  // Handle real-time updates for team chat
  const handleUpdate = useCallback((event: UpdateEvent) => {
    if (event.event !== 'team_message') return;
    if (event.teamId !== teamId) return;

    debugLog('Team chat message received:', event);

    // Append new message from WebSocket event
    if (event.messageId && event.createdAt) {
      const newMessage: TeamChatMessage = {
        id: event.messageId,
        teamId: event.teamId!,
        userId: event.userId!,
        username: event.username || '',
        message: event.message || '',
        attachments: event.attachments || [],
        createdAt: event.createdAt,
      };

      setMessages(prev => {
        // Check if message already exists (avoid duplicates)
        if (prev.some(m => m.id === newMessage.id)) {
          return prev;
        }
        return [...prev, newMessage];
      });

      setTotalMessages(prev => prev + 1);
    }
  }, [teamId]);

  useRealtimeUpdates(handleUpdate, true);

  useEffect(() => {
    if (teamId) {
      fetchMessages();
    }
  }, [teamId, fetchMessages]);

  const sendMessage = useCallback(async (input: TeamChatMessageInput): Promise<void> => {
    if (!teamId) throw new Error('No team selected');

    const response = await axios.post<TeamChatMessage>(
      `/api/teams/${teamId}/chat/messages`,
      input
    );

    // Immediately add the message to the state
    const newMessage = response.data;
    setMessages(prev => {
      if (prev.some(m => m.id === newMessage.id)) {
        return prev;
      }
      return [...prev, newMessage];
    });

    setTotalMessages(prev => prev + 1);
  }, [teamId]);

  const loadMoreMessages = useCallback(async (): Promise<void> => {
    if (!hasMore || !nextCursor) return;
    await fetchMessages(nextCursor, true);
  }, [hasMore, nextCursor, fetchMessages]);

  const refreshMessages = useCallback(async (): Promise<void> => {
    await fetchMessages();
  }, [fetchMessages]);

  return {
    messages,
    loading,
    error,
    hasMore,
    totalMessages,
    sendMessage,
    loadMoreMessages,
    refreshMessages,
  };
}
