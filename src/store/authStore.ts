import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthUser } from '@/lib/supabase/database.types'

interface AuthStore {
  user: AuthUser | null
  isLoading: boolean

  // Actions
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true })
        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
          })

          const data = await res.json()

          if (!res.ok) {
            set({ isLoading: false })
            return { success: false, error: data.error }
          }

          set({ user: data.user, isLoading: false })
          return { success: true }
        } catch {
          set({ isLoading: false })
          return { success: false, error: 'Network error' }
        }
      },

      logout: async () => {
        await fetch('/api/auth/logout', { method: 'POST' })
        set({ user: null })
      },

      fetchMe: async () => {
        try {
          const res = await fetch('/api/auth/me')
          if (res.ok) {
            const data = await res.json()
            set({ user: data.user })
          } else {
            set({ user: null })
          }
        } catch {
          set({ user: null })
        }
      },
    }),
    {
      name: 'auth-store',
      // Only persist non-sensitive user info
      partialize: (state) => ({ user: state.user }),
    }
  )
)