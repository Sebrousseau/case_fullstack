interface Props {
  plotly_file: string;
}

export function PlotlyChart({ plotly_file }: Props) {
  const url = `http://localhost:8000/${plotly_file}`;

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30 overflow-hidden">
      <div className="px-4 py-2 border-b border-blue-200 dark:border-blue-800 flex items-center gap-2">
        <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
          📊 Visualisation
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs text-blue-600 dark:text-blue-400 hover:underline"
        >
          Ouvrir dans un nouvel onglet ↗
        </a>
      </div>
      <iframe
        src={url}
        className="w-full h-[450px] border-0"
        title="Plotly visualization"
      />
    </div>
  );
}
