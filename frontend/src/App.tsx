import { useRef, useEffect } from "react";
import { Bot, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useChat } from "./hooks/useChat";
import { useChatHistory } from "./hooks/useChatHistory";
import { MessageList } from "./components/MessageList";
import { Sidebar } from "./components/SideBar";
import { ChatInput } from "./components/ChatInput";

export default function App() {
  const { turns, isLoading, sendMessage, setTurns } = useChat();
  const {
    conversations,
    activeId,
    createConversation,
    updateConversation,
    deleteConversation,
    setActiveId,
  } = useChatHistory();

  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevActiveIdRef = useRef<string | null>(activeId);

  // Track scroll position — stop auto-scroll if user scrolls up
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const threshold = 100;
    isAtBottomRef.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
  };

  // Auto-scroll on every turns update (covers streaming deltas + new turns)
  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [turns]);

  // Force scroll to bottom when switching conversations
  useEffect(() => {
    if (activeId !== prevActiveIdRef.current) {
      isAtBottomRef.current = true;
      bottomRef.current?.scrollIntoView({ behavior: "instant" });
      prevActiveIdRef.current = activeId;
    }
  }, [activeId]);

  // Persist turns to history on every update
  useEffect(() => {
    if (activeId && turns.length > 0) {
      updateConversation(activeId, turns);
    }
  }, [activeId, turns, updateConversation]);

  const handleSelectConversation = (id: string) => {
    setActiveId(id);
    const conv = conversations.find((c) => c.id === id);
    if (conv) setTurns(conv.turns);
  };

  const handleNewConversation = () => {
    createConversation();
    setTurns([]);
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
    if (id === activeId) setTurns([]);
  };


  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelectConversation}
        onNew={handleNewConversation}
        onDelete={handleDeleteConversation}
      />

      <div className="flex flex-col flex-1 min-w-0">
        {/* Header */}
        <header className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">
              Data Analysis Agent
            </h1>
            <p className="text-xs text-muted-foreground">
              Posez vos questions sur vos données
            </p>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 min-h-0">
          <ScrollArea
            className="h-full px-4 py-6"
            onScrollCapture={handleScroll}
          >
            <div className="max-w-3xl mx-auto flex flex-col gap-8">
              {turns.length === 0 && (
                <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
                  <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
                    <Bot className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground text-sm max-w-xs">
                    Posez une question sur vos datasets — SQL, visualisations et
                    analyses en temps réel.
                  </p>
                </div>
              )}

              {turns.map((turn, i) => (
                <div key={i} className="flex flex-col gap-4">
                  {/* User question */}
                  <div className="flex items-start gap-3 justify-end">
                    <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm max-w-lg">
                      {turn.question}
                    </div>
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-muted shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>

                  {/* Agent response */}
                  <div className="flex items-start gap-3">
                    <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <MessageList
                        blocks={turn.blocks}
                        isStreaming={!turn.done && isLoading}
                      />
                      {turn.error && (
                        <p className="text-sm text-destructive mt-2">
                          Erreur : {turn.error}
                        </p>
                      )}
                    </div>
                  </div>

                  {i < turns.length - 1 && <Separator />}
                </div>
              ))}

              <div ref={bottomRef} />
            </div>
          </ScrollArea>
        </div>

        {/* Input */}
        <ChatInput
          isLoading={isLoading}
          onSend={(q) => {
            if (!activeId) createConversation();
            isAtBottomRef.current = true;
            sendMessage(q);
          }}
        />
      </div>
    </div>
  );
}
