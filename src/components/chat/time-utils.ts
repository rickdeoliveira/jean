/**
 * Format milliseconds as seconds when under a minute, otherwise mm:ss.
 * Examples: "0s", "23s", "02:25"
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  if (minutes === 0) return `${seconds}s`

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
