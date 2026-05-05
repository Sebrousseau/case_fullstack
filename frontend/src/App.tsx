import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useChat } from "./hooks/useChat";
import { MessageList } from "./components/MessageList";

export default function App() {
  const [input, setInput] = useState("");
  const { turns, isLoading, sendMessage } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  const handleSubmit = () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    sendMessage(q);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b px-6 py-4 flex items-center gap-3 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary text-primary-foreground">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-base font-semibold leading-tight">Data Analysis Agent</h1>
          <p className="text-xs text-muted-foreground">Posez vos questions sur vos données</p>
        </div>
      </header>

      {/* Messages area */}
      <ScrollArea className="flex-1 px-4 py-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-8">
          {turns.length === 0 && (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted">
                <Bot className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground text-sm max-w-xs">
                Posez une question sur vos datasets — SQL, visualisations et analyses en temps réel.
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

      {/* Input area */}
      <div className="border-t px-4 py-4 shrink-0">
        <div className="max-w-3xl mx-auto flex gap-3 items-end">
          <textarea
            className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[48px] max-h-40"
            placeholder="Ex : Quel est le total des ventes par région ?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />
          <Button
            onClick={handleSubmit}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="rounded-xl h-12 w-12 shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-2">
          Entrée pour envoyer · Shift+Entrée pour un saut de ligne
        </p>
      </div>
    </div>
  );
}
