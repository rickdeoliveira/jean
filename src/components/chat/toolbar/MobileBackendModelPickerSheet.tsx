import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import type { CliBackend, CustomCliProfile } from '@/types/preferences'
import { BackendModelPickerContent } from '@/components/chat/toolbar/BackendModelPickerContent'
import { useToolbarDropdownShortcuts } from '@/components/chat/toolbar/useToolbarDropdownShortcuts'
import { useIsMobile } from '@/hooks/use-mobile'

interface MobileBackendModelPickerSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessionHasMessages?: boolean
  providerLocked?: boolean
  selectedBackend: CliBackend
  selectedProvider: string | null
  selectedModel: string
  installedBackends: CliBackend[]
  customCliProfiles: CustomCliProfile[]
  onModelChange: (model: string) => void
  onBackendModelChange: (backend: CliBackend, model: string) => void
}

export function MobileBackendModelPickerSheet({
  open,
  onOpenChange,
  sessionHasMessages,
  providerLocked,
  selectedBackend,
  selectedProvider,
  selectedModel,
  installedBackends,
  customCliProfiles,
  onModelChange,
  onBackendModelChange,
}: MobileBackendModelPickerSheetProps) {
  const isMobile = useIsMobile()

  useToolbarDropdownShortcuts({
    setModelDropdownOpen: onOpenChange,
    enabled: isMobile,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="flex max-h-[75svh] rounded-t-xl p-0"
        showCloseButton={false}
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle className="text-base">
            Select Backend &amp; Model
          </SheetTitle>
        </SheetHeader>
        <BackendModelPickerContent
          open={open}
          selectedBackend={selectedBackend}
          selectedProvider={selectedProvider}
          selectedModel={selectedModel}
          installedBackends={installedBackends}
          customCliProfiles={customCliProfiles}
          sessionHasMessages={sessionHasMessages}
          providerLocked={providerLocked}
          onModelChange={onModelChange}
          onBackendModelChange={onBackendModelChange}
          onRequestClose={() => onOpenChange(false)}
          className="min-h-0"
          commandListClassName="max-h-none flex-1 pb-[calc(env(safe-area-inset-bottom)+0.5rem)]"
        />
      </SheetContent>
    </Sheet>
  )
}
