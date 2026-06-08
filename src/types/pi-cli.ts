/**
 * Types for PI CLI management.
 */

export interface PiCliStatus {
  installed: boolean
  version: string | null
  path: string | null
}

export interface PiAuthStatus {
  authenticated: boolean
  error: string | null
}

export interface PiReleaseInfo {
  version: string
  prerelease: boolean
}

export interface PiModelInfo {
  id: string
  label: string
  is_default?: boolean
}
