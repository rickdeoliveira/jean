import { memo, useMemo } from 'react'
import { Loader2, Activity, Brain } from 'lucide-react'
import type { ContentBlock, ToolCall } from '@/types/chat'
import { isPlanToolCall } from '@/types/chat'
import { StreamingMessage } from './StreamingMessage'
import type { ComponentProps } from 'react'

type StreamingMessageProps = ComponentProps<typeof StreamingMessage>

/**
 * Pulls a one-line label/detail out of the latest content block or tool call
 * for the compact streaming ticker.
 */
function summarizeLatest(
  contentBlocks: ContentBlock[],
  toolCalls: ToolCall[],
  streamingContent: string
): { label: string; detail?: string } {
  // Prefer the most recent content block (preserves order of text + tools).
  for (let i = contentBlocks.length - 1; i >= 0; i--) {
    const block = contentBlocks[i]
    if (!block) continue
    if (block.type === 'tool_use') {
      const tc = toolCalls.find(t => t.id === block.tool_call_id)
      if (tc) return summarizeToolCall(tc)
      continue
    }
    if (block.type === 'thinking') {
      return { label: 'Thinking…' }
    }
    if (block.type === 'text' && block.text.trim()) {
      return { label: truncate(block.text.trim(), 120) }
    }
  }

  // No blocks yet — fall back to last tool call or raw streaming text.
  const lastTool = toolCalls[toolCalls.length - 1]
  if (lastTool) return summarizeToolCall(lastTool)
  if (streamingContent.trim()) {
    return { label: truncate(streamingContent.trim(), 120) }
  }
  return { label: 'Working…' }
}

function summarizeToolCall(tc: ToolCall): { label: string; detail?: string } {
  const input = (tc.input ?? {}) as Record<string, unknown>
  const filePath =
    typeof input.file_path === 'string' ? input.file_path : undefined
  const path = typeof input.path === 'string' ? input.path : undefined
  const command = typeof input.command === 'string' ? input.command : undefined
  const url = typeof input.url === 'string' ? input.url : undefined
  const pattern = typeof input.pattern === 'string' ? input.pattern : undefined
  const description =
    typeof input.description === 'string' ? input.description : undefined

  const detail =
    filePath ?? path ?? command ?? url ?? pattern ?? description ?? undefined
  return {
    label: tc.name,
    detail: detail ? truncate(detail, 80) : undefined,
  }
}

function truncate(text: string, max: number): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

/**
 * Compact replacement for {@link StreamingMessage} when the
 * `compact_chat_view_enabled` preference is on.
 *
 * Renders a single ticker line showing the latest content block or tool call.
 * Falls through to the full {@link StreamingMessage} when the in-flight
 * response includes a plan, so the user can approve / read the plan as it forms.
 */
export const CompactStreamingTicker = memo(function CompactStreamingTicker(
  props: StreamingMessageProps
) {
  const { contentBlocks, toolCalls, streamingContent } = props

  const containsPlan = useMemo(() => {
    if (toolCalls.some(isPlanToolCall)) return true
    return contentBlocks.some(b => {
      if (b.type !== 'tool_use') return false
      const tc = toolCalls.find(t => t.id === b.tool_call_id)
      return tc ? isPlanToolCall(tc) : false
    })
  }, [contentBlocks, toolCalls])

  if (containsPlan) {
    return <StreamingMessage {...props} />
  }

  const { label, detail } = summarizeLatest(
    contentBlocks,
    toolCalls,
    streamingContent
  )

  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground min-w-0">
      {label === 'Thinking…' ? (
        <Brain className="h-3.5 w-3.5 shrink-0 opacity-70" />
      ) : (
        <Activity className="h-3.5 w-3.5 shrink-0 opacity-70" />
      )}
      <span className="font-medium truncate">{label}</span>
      {detail && (
        <code className="truncate rounded bg-muted/50 px-1.5 py-0.5 text-xs">
          {detail}
        </code>
      )}
      <Loader2 className="ml-auto h-3 w-3 shrink-0 animate-spin opacity-50" />
    </div>
  )
})
