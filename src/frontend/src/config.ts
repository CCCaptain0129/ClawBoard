const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')
const ACCESS_TOKEN_STORAGE_KEY = 'board_access_token'

export const apiBaseUrl = trimTrailingSlash(import.meta.env.VITE_API_URL || '')

export const getStoredAccessToken = () => {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) || ''
}

export const setStoredAccessToken = (token: string) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, token)
}

export const clearStoredAccessToken = () => {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY)
}

export const buildAuthHeaders = (headers: HeadersInit = {}) => {
  const token = getStoredAccessToken()
  if (!token) return headers

  return {
    ...headers,
    Authorization: `Bearer ${token}`,
  }
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const response = await fetch(input, {
    ...init,
    headers: buildAuthHeaders(init.headers),
  })

  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('board-auth-invalid'))
  }

  return response
}

export const buildApiUrl = (pathname: string) => {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  return apiBaseUrl ? `${apiBaseUrl}${normalizedPath}` : normalizedPath
}

export const buildWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    const token = encodeURIComponent(getStoredAccessToken())
    return token ? `${import.meta.env.VITE_WS_URL}${import.meta.env.VITE_WS_URL.includes('?') ? '&' : '?'}token=${token}` : import.meta.env.VITE_WS_URL
  }

  if (typeof window === 'undefined') {
    return 'ws://localhost:3001'
  }

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  const token = encodeURIComponent(getStoredAccessToken())
  const baseUrl = `${protocol}//${window.location.hostname}:3001`
  return token ? `${baseUrl}?token=${token}` : baseUrl
}
