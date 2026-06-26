/** Types for Command Code CLI management. */

export interface CommandCodeCliStatus {
  installed: boolean
  version: string | null
  path: string | null
}

export interface CommandCodeAuthStatus {
  authenticated: boolean
  error: string | null
  timedOut?: boolean
}

export interface CommandCodePathDetection {
  found: boolean
  path: string | null
  version: string | null
  packageManager: string | null
}

export interface CommandCodeInstallCommand {
  command: string
  args: string[]
  description: string
}

export interface CommandCodeModelInfo {
  id: string
  label: string
}

export interface CommandCodeReleaseInfo {
  version: string
  tagName: string
  publishedAt: string
  prerelease: boolean
}

export interface CommandCodeInstallProgress {
  stage: string
  message: string
  percent: number
}
