import type { MessageBlock } from "../types";
import { ThinkingBlock } from "./ThinkingBlock";
import { ToolCallBlock, ToolResultBlock } from "./ToolCallBlock";
import { PlotlyChart } from "./PlotlyChart";

interface Props {
  blocks: MessageBlock[];
  isStreaming?: boolean;
}

export function MessageList({ blocks, isStreaming }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "thinking":
            return <ThinkingBlock key={i} content={block.content} />;

          case "tool_call":
            return (
              <ToolCallBlock
                key={i}
                tool={block.tool}
                args={block.args}
              />
            );

          case "tool_result":
            return (
              <div key={i} className="flex flex-col gap-2">
                <ToolResultBlock
                  content={block.content}
                  plotly_file={block.plotly_file}
                />
                {block.plotly_file && (
                  <PlotlyChart plotly_file={block.plotly_file} />
                )}
              </div>
            );

          case "text":
            return (
              <div
                key={i}
                className="text-sm text-foreground leading-relaxed whitespace-pre-wrap"
              >
                {block.content}
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-foreground animate-pulse rounded-sm" />
                )}
              </div>
            );
        }
      })}
    </div>
  );
}
