import { useEffect, useState, useCallback, useRef } from 'react'

interface UpdateInfo {
  current_version: string
  new_version: string
  body: string | null
  ready: boolean // true if downloaded & installed, waiting for restart
}

interface TauriAPI {
  core: {
    invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>
  }
  event: {
    listen: <T>(event: string, handler: (event: { payload: T }) => void) => Promise<() => void>
  }
}

declare global {
  interface Window {
    __TAURI__?: TauriAPI
  }
}

const DISMISSED_KEY = 'update-banner-dismissed'

// Module-level cache to persist across component remounts
let cachedUpdateInfo: UpdateInfo | null = null
let hasChecked = false
let backgroundDownloadStarted = false

/**
 * Parse version string into components
 * Handles formats like "1.2.3", "v1.2.3", "1.2.3-beta"
 */
function parseVersion(version: string): { major: number; minor: number; patch: number } | null {
  const cleaned = version.replace(/^v/, '').split('-')[0]
  const parts = cleaned.split('.').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) {
    return null
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] }
}

/**
 * Check if update is major or minor (not just a patch)
 */
function isMajorOrMinorUpdate(currentVersion: string, newVersion: string): boolean {
  const current = parseVersion(currentVersion)
  const next = parseVersion(newVersion)

  if (!current || !next) {
    return true
  }

  if (next.major > current.major) {
    return true
  }

  if (next.major === current.major && next.minor > current.minor) {
    return true
  }

  return false
}

export function useUpdateChecker() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISSED_KEY)) {
      return null
    }
    return cachedUpdateInfo
  })
  const [isTauri, setIsTauri] = useState(() => typeof window !== 'undefined' && !!window.__TAURI__)
  const [isChecking, setIsChecking] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const checkInProgress = useRef(false)

  // Start background download and install
  const startBackgroundUpdate = useCallback(async () => {
    const tauri = window.__TAURI__
    if (!tauri || backgroundDownloadStarted) return

    backgroundDownloadStarted = true
    setDownloadProgress(0)

    try {
      await tauri.core.invoke('start_background_update')
      // Update will be marked as ready via the check
      setDownloadProgress(null)
      // Re-check to get the ready state
      const result = await tauri.core.invoke<UpdateInfo | null>('check_update_available')
      if (result) {
        cachedUpdateInfo = result
        setUpdateAvailable(result)
      }
    } catch (e) {
      console.error('Background update failed:', e)
      setDownloadProgress(null)
      backgroundDownloadStarted = false
    }
  }, [])

  const checkForUpdates = useCallback(
    async (force = false) => {
      const tauri = window.__TAURI__
      if (!tauri) return

      if ((hasChecked && !force) || checkInProgress.current) {
        return
      }

      if (sessionStorage.getItem(DISMISSED_KEY)) {
        return
      }

      checkInProgress.current = true
      setIsChecking(true)
      try {
        const result = await tauri.core.invoke<UpdateInfo | null>('check_update_available')
        hasChecked = true

        if (result && isMajorOrMinorUpdate(result.current_version, result.new_version)) {
          cachedUpdateInfo = result
          setUpdateAvailable(result)

          // If update available but not ready, start background download
          if (!result.ready && !backgroundDownloadStarted) {
            startBackgroundUpdate()
          }
        } else {
          cachedUpdateInfo = null
          setUpdateAvailable(null)
        }
      } catch (e) {
        console.error('Failed to check for updates:', e)
      } finally {
        setIsChecking(false)
        checkInProgress.current = false
      }
    },
    [startBackgroundUpdate]
  )

  useEffect(() => {
    const tauri = window.__TAURI__
    if (!tauri) return

    setIsTauri(true)

    // Listen for background download progress
    let unlisten: (() => void) | null = null
    tauri.event
      .listen<{ percent: number }>('background-update-progress', (event) => {
        setDownloadProgress(event.payload.percent)
      })
      .then((fn) => {
        unlisten = fn
      })

    // Check for updates on mount
    checkForUpdates()

    // Check every 30 minutes
    const interval = setInterval(() => checkForUpdates(true), 30 * 60 * 1000)

    return () => {
      clearInterval(interval)
      if (unlisten) unlisten()
    }
  }, [checkForUpdates])

  const restartToUpdate = useCallback(async () => {
    const tauri = window.__TAURI__
    if (tauri) {
      await tauri.core.invoke('restart_for_update')
    }
  }, [])

  const dismissUpdate = useCallback(() => {
    sessionStorage.setItem(DISMISSED_KEY, 'true')
    setUpdateAvailable(null)
  }, [])

  return {
    updateAvailable,
    isTauri,
    isChecking,
    downloadProgress,
    isDownloading: downloadProgress !== null && downloadProgress < 100,
    isReady: updateAvailable?.ready ?? false,
    restartToUpdate,
    dismissUpdate,
    checkForUpdates: () => checkForUpdates(true),
  }
}
