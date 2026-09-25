import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

/**
 * Convert a caught error into a UI-safe message.
 * Never pass err.message / err.details / err.hint (e.g. raw Supabase
 * errors) directly to the UI — always go through this helper.
 * Detects offline/network failures first, otherwise returns the
 * caller-supplied generic fallback.
 */
export const getErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!navigator.onLine || error?.message === 'Failed to fetch' || error?.name === 'TypeError') {
    return 'No internet connection. Please check your network and try again.'
  }
  return fallback
}
