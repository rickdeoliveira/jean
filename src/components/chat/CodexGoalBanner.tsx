import { useCallback, useState } from 'react'
import { Target, X } from 'lucide-react'
import { toast } from 'sonner'
import { invoke } from '@/lib/transport'
import { useChatStore } from '@/store/chat-store'
import { Button } from '@/components/ui/button'

interface CodexGoalBannerProps {
  sessionId: string | null
  worktreeId: string | null
  worktreePath: string | null
  /** Only render for codex backend sessions */
  isCodexBackend: boolean
}

export function CodexGoalBanner({
  sessionId,
  worktreeId,
  worktreePath,
  isCodexBackend,
}: CodexGoalBannerProps) {
  const goal = useChatStore(state =>
    sessionId ? (state.codexGoals[sessionId] ?? null) : null
  )
  const [clearing, setClearing] = useState(false)

  const handleClear = useCallback(async () => {
    if (!sessionId || !worktreeId || !worktreePath || clearing) return
    setClearing(true)
    try {
      await invoke('codex_goal_clear', {
        worktreeId,
        worktreePath,
        sessionId,
      })
      toast.success('Goal cleared')
    } catch (err) {
      toast.error(`Failed to clear goal: ${err}`)
    } finally {
      setClearing(false)
    }
  }, [sessionId, worktreeId, worktreePath, clearing])

  if (!isCodexBackend || !goal) return null

  return (
    <div className="mb-2 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm dark:border-blue-900 dark:bg-blue-950/40">
      <Target className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
      <div className="flex-1">
        <div className="text-xs font-medium uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Goal
        </div>
        <div className="text-foreground">{goal}</div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        onClick={handleClear}
        disabled={clearing}
        aria-label="Clear goal"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
