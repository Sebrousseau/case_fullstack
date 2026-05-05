import { useState, useCallback, useEffect } from "react";
import type { ChatTurn } from "./useChat";

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  turns: ChatTurn[];
}

const STORAGE_KEY = "chat_history";

function loadFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(conversations: Conversation[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  } catch {
    // Ignore storage write errors (quota exceeded/private mode).
  }
}

export function useChatHistory() {
  const [conversations, setConversations] = useState<Conversation[]>(loadFromStorage);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Persist on every change
  useEffect(() => {
    saveToStorage(conversations);
  }, [conversations]);

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

  const updateConversation = useCallback((id: string, turns: ChatTurn[]) => {
    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        // Use first question as title
        const title = turns[0]?.question ?? "Nouvelle conversation";
        return { ...c, title: title.slice(0, 60), turns };
      })
    );
  }, []);

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
