import { useRef, useState } from "react";
import { Send, Loader2, Paperclip, X, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface AttachedFile {
  file: File;
  status: "pending" | "uploading" | "done" | "error";
  datasetName?: string;
  error?: string;
}

interface ChatInputProps {
  isLoading: boolean;
  onSend: (question: string) => void;
  onDatasetUploaded?: (name: string, rows: number, columns: string[]) => void;
}

export function ChatInput({ isLoading, onSend, onDatasetUploaded }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [attached, setAttached] = useState<AttachedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput("");
    setAttached(null);
    onSend(q);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-uploaded
    e.target.value = "";

    if (!file.name.endsWith(".csv")) {
      setAttached({ file, status: "error", error: "Seuls les fichiers CSV sont supportés." });
      return;
    }

    setAttached({ file, status: "uploading" });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setAttached({ file, status: "error", error: data.error });
        return;
      }

      setAttached({ file, status: "done", datasetName: data.name });
      onDatasetUploaded?.(data.name, data.rows, data.columns);
    } catch {
      setAttached({ file, status: "error", error: "Erreur lors de l'upload." });
    }
  };

  const removeAttached = () => {
    setAttached(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="border-t px-4 py-4 shrink-0">
      <div className="max-w-3xl mx-auto flex flex-col gap-2">

        {/* Fichier joint */}
        {attached && (
          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border w-fit max-w-full
              ${attached.status === "error"
                ? "bg-destructive/10 border-destructive/30 text-destructive"
                : attached.status === "done"
                  ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/30 dark:border-green-800 dark:text-green-300"
                  : "bg-muted border-border text-muted-foreground"
              }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 shrink-0" />

            <span className="truncate max-w-[200px] font-medium">
              {attached.file.name}
            </span>

            {attached.status === "uploading" && (
              <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            )}
            {attached.status === "done" && (
              <span className="text-green-600 dark:text-green-400 shrink-0">✓ chargé</span>
            )}
            {attached.status === "error" && (
              <span className="shrink-0">{attached.error}</span>
            )}

            <button
              onClick={removeAttached}
              className="ml-1 hover:opacity-70 shrink-0"
              aria-label="Supprimer le fichier"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Zone de saisie */}
        <div className="flex gap-3 items-end">

          {/* Bouton upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-xl h-12 w-12 shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || attached?.status === "uploading"}
            title="Joindre un fichier CSV"
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-h-[48px] max-h-40"
            placeholder="Ex : Quel est le total des ventes par région ?"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={isLoading}
          />

          {/* Bouton envoyer */}
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

        <p className="text-center text-xs text-muted-foreground">
          Entrée pour envoyer · Shift+Entrée pour un saut de ligne · CSV acceptés
        </p>
      </div>
    </div>
  );
}
