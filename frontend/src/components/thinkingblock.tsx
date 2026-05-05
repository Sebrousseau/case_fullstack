import { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";

interface Props {
  content: string;
}

export function ThinkingBlock({ content }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/30 rounded-lg transition-colors"
      >
        <Brain className="h-4 w-4 shrink-0" />
        <span className="font-medium">Raisonnement</span>
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 text-sm text-violet-800 dark:text-violet-200 whitespace-pre-wrap font-mono leading-relaxed border-t border-violet-200 dark:border-violet-800">
          {content}
        </div>
      )}
    </div>
  );
}
