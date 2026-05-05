import { Trash2, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Conversation } from "../hooks/useChatHistory";

interface Props {
  conversations: Conversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}

function formatDate(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) {
    return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export function Sidebar({ conversations, activeId, onSelect, onNew, onDelete }: Props) {
  return (
    <aside className="w-64 shrink-0 border-r flex flex-col bg-muted/30 h-screen">
      {/* Header */}
      <div className="px-3 py-4 flex items-center justify-between shrink-0">
        <span className="text-sm font-semibold text-foreground">Historique</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          onClick={onNew}
          title="Nouvelle conversation"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <Separator />

      {/* Conversation list */}
      <ScrollArea className="flex-1 px-2 py-2">
        {conversations.length === 0 && (
          <p className="text-xs text-muted-foreground text-center mt-8 px-4">
            Aucune conversation pour l'instant
          </p>
        )}
        <div className="flex flex-col gap-1">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group flex items-start gap-2 rounded-lg px-3 py-2.5 cursor-pointer transition-colors ${conv.id === activeId
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-foreground"
                }`}
              onClick={() => onSelect(conv.id)}
            >
              <MessageSquare
                className={`h-4 w-4 mt-0.5 shrink-0 ${conv.id === activeId ? "text-primary-foreground" : "text-muted-foreground"
                  }`}
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate leading-tight">{conv.title}</p>
                <p
                  className={`text-xs mt-0.5 ${conv.id === activeId ? "text-primary-foreground/70" : "text-muted-foreground"
                    }`}
                >
                  {formatDate(conv.createdAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(conv.id);
                }}
                className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/20 ${conv.id === activeId ? "text-primary-foreground/70" : "text-muted-foreground"
                  }`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}
