import { useRouter } from 'expo-router';
import { useCallback } from 'react';

import { useAppContext, type ChatMessage } from '@/context/AppContext';
import type { AiToolSession } from '@/types/aiToolSession';

type SeedMessage = Pick<ChatMessage, 'role' | 'modality' | 'content'> & {
  id?: string;
  timestamp?: string;
};

type OpenSeededArgs = {
  session: AiToolSession;
  messages: SeedMessage[];
  /** Optional follow-up question to send after opening the seeded thread */
  followUp?: string;
};

type OpenAutoSendArgs = {
  session: AiToolSession;
  prompt: string;
};

/**
 * Opens AgriSense AI with a tool result session (banner + suggestions + chat continuity).
 */
export function useAiAdvisor() {
  const router = useRouter();
  const { setActiveAiSession, clearChatHistory, addChatMessages } = useAppContext();

  const openSeeded = useCallback(
    ({ session, messages, followUp }: OpenSeededArgs) => {
      clearChatHistory();
      setActiveAiSession(session);
      const now = Date.now();
      addChatMessages(
        messages.map((m, i) => ({
          ...m,
          id: m.id ?? `${session.tool}-ctx-${i}-${session.id}`,
          timestamp: m.timestamp ?? new Date(now - (messages.length - i) * 1000).toISOString(),
        })),
      );
      router.push({
        pathname: '/(tabs)/chat',
        params: {
          continueTool: '1',
          ...(session.conversationId ? { conversationId: session.conversationId } : {}),
          ...(followUp
            ? {
                prompt: followUp,
                autoSend: '1',
              }
            : {}),
        },
      });
    },
    [addChatMessages, clearChatHistory, router, setActiveAiSession],
  );

  const openAutoSend = useCallback(
    ({ session, prompt }: OpenAutoSendArgs) => {
      clearChatHistory();
      setActiveAiSession(session);
      router.push({
        pathname: '/(tabs)/chat',
        params: {
          continueTool: '1',
          prompt,
          autoSend: '1',
          ...(session.conversationId ? { conversationId: session.conversationId } : {}),
        },
      });
    },
    [clearChatHistory, router, setActiveAiSession],
  );

  return { openSeeded, openAutoSend };
}
