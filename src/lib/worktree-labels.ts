import type { LabelData } from '@/types/chat'
import type { Worktree } from '@/types/projects'

export function getWorktreeLabels(
  worktree: Pick<Worktree, 'labels' | 'label'> | null | undefined
): LabelData[] {
  if (!worktree) return []
  const labels =
    worktree.labels && worktree.labels.length > 0
      ? worktree.labels
      : worktree.label
        ? [worktree.label]
        : []
  const seen = new Set<string>()
  const result: LabelData[] = []
  for (const label of labels) {
    const key = label.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(label)
  }
  return result
}

export function updateWorktreeLabelsByName(
  labels: LabelData[],
  labelName: string,
  newColor: string
): LabelData[] {
  return labels.map(label =>
    label.name === labelName ? { ...label, color: newColor } : label
  )
}
