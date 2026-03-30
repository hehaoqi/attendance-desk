interface ElectronLogPayload {
  level?: 'info' | 'warn' | 'error'
  message: string
  meta?: unknown
}

interface ElectronAPI {
  platform: string
  log?: (payload: ElectronLogPayload) => void
  getLogPaths?: () => Promise<{ dir: string; app: string; error: string }>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}