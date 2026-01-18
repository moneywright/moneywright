import axios, { type AxiosError } from 'axios'

// Create axios instance with defaults
export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Track if we're currently refreshing
let isRefreshing = false
let refreshPromise: Promise<boolean> | null = null

/**
 * Attempt to refresh the access token
 */
async function refreshAccessToken(): Promise<boolean> {
  try {
    const response = await api.post('/auth/refresh')
    return response.data.success === true
  } catch {
    return false
  }
}

// Response interceptor for handling 401s with refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config

    // If it's a 401 and not from auth/refresh itself
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/logout')
    ) {
      // If already refreshing, wait for it
      if (isRefreshing && refreshPromise) {
        const success = await refreshPromise
        if (success) {
          return api(originalRequest)
        }
        throw error
      }

      // Start refresh
      isRefreshing = true
      refreshPromise = refreshAccessToken()

      try {
        const success = await refreshPromise
        if (success) {
          // Retry the original request
          return api(originalRequest)
        }
      } finally {
        isRefreshing = false
        refreshPromise = null
      }
    }

    return Promise.reject(error)
  }
)
