const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

export const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_URL || '')

export const buildApiUrl = (pathname: string) => {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath
}

export const wsUrl = (() => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL
  }

  if (typeof window === 'undefined') {
    return 'ws://localhost:3001'
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.hostname}:3001`
})()
