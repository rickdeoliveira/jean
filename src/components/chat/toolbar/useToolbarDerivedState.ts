import { useMemo } from 'react'
import {
  getModelFastInfo,
  type ClaudeModel,
  type CustomCliProfile,
} from '@/types/preferences'
import {
  CODEX_MODEL_OPTIONS,
  CURSOR_MODEL_OPTIONS,
  COMMANDCODE_MODEL_OPTIONS,
  GROK_MODEL_OPTIONS,
  MODEL_OPTIONS,
  OPENCODE_MODEL_OPTIONS,
  PI_MODEL_OPTIONS,
} from '@/components/chat/toolbar/toolbar-options'
import type { CliBackend } from '@/types/preferences'
import { sortModelOptionsByRawModel } from '@/components/chat/toolbar/toolbar-utils'

interface UseToolbarDerivedStateArgs {
  selectedBackend: CliBackend
  selectedProvider: string | null
  selectedModel: string
  opencodeModelOptions?: { value: string; label: string }[]
  cursorModelOptions?: { value: string; label: string }[]
  piModelOptions?: { value: string; label: string }[]
  commandcodeModelOptions?: { value: string; label: string }[]
  grokModelOptions?: { value: string; label: string }[]
  customCliProfiles: CustomCliProfile[]
  installedBackends?: CliBackend[]
  availableMcpServers?: { name: string; disabled?: boolean }[]
  enabledMcpServers?: string[]
}

export function useToolbarDerivedState({
  selectedBackend,
  selectedProvider,
  selectedModel,
  opencodeModelOptions,
  cursorModelOptions,
  piModelOptions,
  commandcodeModelOptions,
  customCliProfiles,
  grokModelOptions,
  installedBackends = [
    'claude',
    'codex',
    'opencode',
    'cursor',
    'pi',
    'commandcode',
    'grok',
  ],
  availableMcpServers = [],
  enabledMcpServers = [],
}: UseToolbarDerivedStateArgs) {
  const isCodex = selectedBackend === 'codex'
  const isOpencode = selectedBackend === 'opencode'
  const isCursor = selectedBackend === 'cursor'
  const isPi = selectedBackend === 'pi'
  const isCommandCode = selectedBackend === 'commandcode'
  const isGrok = selectedBackend === 'grok'

  const activeMcpCount = useMemo(() => {
    const availableNames = new Set(
      availableMcpServers.filter(s => !s.disabled).map(s => s.name)
    )
    return enabledMcpServers.filter(name => availableNames.has(name)).length
  }, [availableMcpServers, enabledMcpServers])

  const claudeModelOptions = useMemo(() => {
    if (!selectedProvider || selectedProvider === '__anthropic__') {
      return MODEL_OPTIONS
    }

    const profile = customCliProfiles.find(p => p.name === selectedProvider)
    let opusModel: string | undefined
    let sonnetModel: string | undefined
    let haikuModel: string | undefined
    if (profile?.settings_json) {
      try {
        const settings = JSON.parse(profile.settings_json)
        const env = settings?.env
        if (env) {
          opusModel = env.ANTHROPIC_DEFAULT_OPUS_MODEL || env.ANTHROPIC_MODEL
          sonnetModel =
            env.ANTHROPIC_DEFAULT_SONNET_MODEL || env.ANTHROPIC_MODEL
          haikuModel = env.ANTHROPIC_DEFAULT_HAIKU_MODEL || env.ANTHROPIC_MODEL
        }
      } catch {
        // ignore parse errors
      }
    }

    const suffix = (model?: string) => (model ? ` (${model})` : '')
    return [
      { value: 'opus' as ClaudeModel, label: `Opus${suffix(opusModel)}` },
      { value: 'sonnet' as ClaudeModel, label: `Sonnet${suffix(sonnetModel)}` },
      { value: 'haiku' as ClaudeModel, label: `Haiku${suffix(haikuModel)}` },
    ]
  }, [selectedProvider, customCliProfiles])

  const codexModelOptions = sortModelOptionsByRawModel(
    CODEX_MODEL_OPTIONS as { value: string; label: string }[]
  )
  const resolvedOpencodeModelOptions = sortModelOptionsByRawModel(
    opencodeModelOptions ?? OPENCODE_MODEL_OPTIONS
  )
  const resolvedCursorModelOptions = sortModelOptionsByRawModel(
    cursorModelOptions ?? CURSOR_MODEL_OPTIONS
  )
  const resolvedPiModelOptions = sortModelOptionsByRawModel(
    piModelOptions ?? PI_MODEL_OPTIONS
  )
  const resolvedCommandCodeModelOptions =
    commandcodeModelOptions ?? COMMANDCODE_MODEL_OPTIONS
  const resolvedGrokModelOptions = grokModelOptions ?? GROK_MODEL_OPTIONS

  const backendModelSections = useMemo(() => {
    const sections: {
      backend: CliBackend
      label: string
      options: { value: string; label: string }[]
    }[] = []

    for (const backend of installedBackends) {
      if (backend === 'claude') {
        sections.push({
          backend,
          label: 'Claude',
          options: claudeModelOptions,
        })
      } else if (backend === 'codex') {
        sections.push({
          backend,
          label: 'Codex',
          options: codexModelOptions,
        })
      } else if (backend === 'opencode') {
        sections.push({
          backend,
          label: 'OpenCode',
          options: resolvedOpencodeModelOptions,
        })
      } else if (backend === 'cursor') {
        sections.push({
          backend,
          label: 'Cursor',
          options: resolvedCursorModelOptions,
        })
      } else if (backend === 'pi') {
        sections.push({
          backend,
          label: 'PI',
          options: resolvedPiModelOptions,
        })
      } else if (backend === 'commandcode') {
        sections.push({
          backend,
          label: 'Command Code',
          options: resolvedCommandCodeModelOptions,
        })
      } else if (backend === 'grok') {
        sections.push({
          backend,
          label: 'Grok (Beta)',
          options: resolvedGrokModelOptions,
        })
      }
    }

    return sections
  }, [
    claudeModelOptions,
    codexModelOptions,
    installedBackends,
    resolvedCursorModelOptions,
    resolvedCommandCodeModelOptions,
    resolvedGrokModelOptions,
    resolvedOpencodeModelOptions,
    resolvedPiModelOptions,
  ])

  const filteredModelOptions = useMemo(() => {
    if (isCodex) return codexModelOptions
    if (isOpencode) return resolvedOpencodeModelOptions
    if (isCursor) return resolvedCursorModelOptions
    if (isPi) return resolvedPiModelOptions
    if (isCommandCode) return resolvedCommandCodeModelOptions
    if (isGrok) return resolvedGrokModelOptions
    return claudeModelOptions
  }, [
    claudeModelOptions,
    codexModelOptions,
    isCodex,
    isCursor,
    isPi,
    isCommandCode,
    isGrok,
    isOpencode,
    resolvedCommandCodeModelOptions,
    resolvedCursorModelOptions,
    resolvedGrokModelOptions,
    resolvedOpencodeModelOptions,
    resolvedPiModelOptions,
  ])

  // Fast variants share a label with their base model (the Zap indicator
  // distinguishes them visually). Applies to both Codex and Claude.
  const fastInfo = getModelFastInfo(selectedBackend, selectedModel)
  const labelLookupKey = fastInfo.isFast ? fastInfo.baseModel : selectedModel

  const selectedModelLabel =
    filteredModelOptions.find(o => o.value === labelLookupKey)?.label ??
    labelLookupKey

  return {
    isCodex,
    isCursor,
    isPi,
    isCommandCode,
    isOpencode,
    activeMcpCount,
    backendModelSections,
    claudeModelOptions,
    cursorModelOptions: resolvedCursorModelOptions,
    commandcodeModelOptions: resolvedCommandCodeModelOptions,
    filteredModelOptions,
    opencodeModelOptions: resolvedOpencodeModelOptions,
    piModelOptions: resolvedPiModelOptions,
    grokModelOptions: resolvedGrokModelOptions,
    isGrok,
    selectedModelLabel,
  }
}
