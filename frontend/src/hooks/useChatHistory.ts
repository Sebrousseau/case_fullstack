/**
 * useChatHistory — persistent conversation history backed by localStorage.
 *
 * Stores the full list of conversations (each containing all turns and blocks)
 * so the user can navigate back to previous sessions after a page refresh.
 *
 * Persistence strategy:
 *   - The entire conversations array is serialized to localStorage on every
 *     state update via a useEffect. This is intentionally simple — for larger
 *     datasets a debounced write or IndexedDB would be more appropriate.
 *   - Reads happen once at hook initialization via lazy useState initializer,
 *     avoiding repeated localStorage access on re-renders.
 *
 * Title generation:
 *   - The conversation title is derived from the first question asked.
 *     It is truncated to 50 characters to fit the sidebar comfortably.
 */

import { useState, useCallback, useEffect } from "react";
import type { ChatTurn } from "./useChat";

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  turns: ChatTurn[];
}

const STORAGE_KEY = "chat_history";

/** Read conversations from localStorage. Returns an empty array on any error. */
function loadFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    // Handles JSON parse errors and environments where localStorage is unavailable
    return [];
  }
}

/** Persist conversations to localStorage. Fails silently on quota errors. */
function saveToStorage(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Quota exceeded or private browsing mode — history will not persist
  }
}

export function useChatHistory() {
  // Lazy initializer runs loadFromStorage only once, not on every render
  const [conversations, setConversations] = useState<Conversation[]>(loadFromStorage);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Write to localStorage whenever the conversations array changes
  useEffect(() => {
    saveToStorage(conversations);
  }, [conversations]);

  /**
   * Create a new empty conversation, add it to the top of the list, and
   * make it active. Returns the new conversation's ID so the caller can
   * associate subsequent turns with it.
   */
  const createConversation = useCallback((): string => {
    const id = crypto.randomUUID();
    const conv: Conversation = {
      id,
      title: "Nouvelle conversation",
      createdAt: Date.now(),
      turns: [],
    };
    setConversations((prev) => [conv, ...prev]);
    setActiveId(id);
    return id;
  }, []);

  /**
   * Update the turns of an existing conversation and refresh its title.
   * Called on every streaming update so the sidebar title reflects the
   * first question as soon as it is sent.
   */
  const updateConversation = useCallback((id: string, turns: ChatTurn[]) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const title = turns[0]?.question ?? "Nouvelle conversation";
        return { ...c, title: title.slice(0, 50), turns };
      })
    );
  }, []);

  /**
   * Remove a conversation from the list. If it was the active conversation,
   * reset activeId so the main panel shows the empty state.
   */
  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeId === id) setActiveId(null);
    },
    [activeId]
  );

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  return {
    conversations,
    activeId,
    activeConversation,
    setActiveId,
    createConversation,
    updateConversation,
    deleteConversation,
  };
}
