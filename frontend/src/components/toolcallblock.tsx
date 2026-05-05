import { useState } from "react";
import { ChevronDown, ChevronRight, Wrench, CheckCircle } from "lucide-react";
import { Badge } from "./ui/badge";

interface ToolCallProps {
  tool: string;
  args: Record<string, unknown>;
}

interface ToolResultProps {
  content: string;
  plotly_file?: string | null;
}

export function ToolCallBlock({ tool, args }: ToolCallProps) {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition-colors"
      >
        <Wrench className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="font-medium text-amber-800 dark:text-amber-200">
          Outil
        </span>
        <Badge
          variant="secondary"
          className="bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100 text-xs"
        >
          {tool}
        </Badge>
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4 text-amber-600" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-amber-600" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t border-amber-200 dark:border-amber-800">
          {Object.entries(args).map(([key, value]) => (
            <div key={key} className="mt-2">
              <span className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide">
                {key}
              </span>
              <pre className="mt-1 text-xs bg-amber-100 dark:bg-amber-900/40 rounded p-2 overflow-x-auto text-amber-900 dark:text-amber-100 whitespace-pre-wrap">
                {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ToolResultBlock({ content, plotly_file }: ToolResultProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-4 py-2 text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg transition-colors"
      >
        <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="font-medium text-emerald-800 dark:text-emerald-200">
          Résultat
        </span>
        {plotly_file && (
          <Badge
            variant="secondary"
            className="bg-emerald-200 text-emerald-900 dark:bg-emerald-800 dark:text-emerald-100 text-xs"
          >
            Visualisation
          </Badge>
        )}
        {open ? (
          <ChevronDown className="ml-auto h-4 w-4 text-emerald-600" />
        ) : (
          <ChevronRight className="ml-auto h-4 w-4 text-emerald-600" />
        )}
      </button>
      {open && (
        <pre className="px-4 pb-3 pt-1 text-xs text-emerald-900 dark:text-emerald-100 whitespace-pre-wrap border-t border-emerald-200 dark:border-emerald-800 overflow-x-auto">
          {content}
        </pre>
      )}
    </div>
  );
}
