import { useRegisterSW } from "virtual:pwa-register/react"
import { RefreshCw } from "lucide-react"

export function SWUpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      setInterval(() => registration.update(), 60 * 60 * 1000)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-bg-elevated border border-border-default px-4 py-3 shadow-lg animate-slide-up">
      <RefreshCw className="h-5 w-5 text-text-secondary shrink-0" />
      <span className="text-sm text-text-primary flex-1">Update available</span>
      <button
        onClick={() => updateServiceWorker(true)}
        className="rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-white/15 active:bg-white/20 transition-colors"
      >
        Reload
      </button>
    </div>
  )
}
