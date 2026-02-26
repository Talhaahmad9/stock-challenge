'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/authStore'

export default function LoginPage() {
  const router = useRouter()
  const { login, isLoading } = useAuthStore()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const result = await login(username, password)

    if (!result.success) {
      setError(result.error ?? 'Authentication failed')
    } else {
      const user = useAuthStore.getState().user
      if (user?.role === 'admin') {
        router.push('/admin')
      } else {
        router.push('/trade')
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#000000] flex flex-col items-center justify-center px-4">
      {/* Card */}
      <div className="w-full max-w-sm bg-white/5 backdrop-blur-md border border-green-500/20 rounded-lg p-8 flex flex-col gap-6">
        {/* Header */}
        <div className="flex flex-col items-center gap-1">
          <h1
            className="text-3xl font-mono font-bold uppercase text-green-400 tracking-widest"
            style={{ textShadow: '0 0 20px #00ff41' }}
          >
            STOCK CHALLENGE
          </h1>
          <p className="text-xs tracking-widest text-green-500/60 uppercase">
            Trading Simulation Platform
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="USERNAME"
            autoComplete="username"
            required
            className="w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-4 py-3 font-mono text-sm focus:border-green-400 focus:outline-none transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="PASSWORD"
            autoComplete="current-password"
            required
            className="w-full bg-black border border-green-500/30 text-green-300 placeholder-green-900 rounded px-4 py-3 font-mono text-sm focus:border-green-400 focus:outline-none transition-colors"
          />

          {/* Error */}
          {error && (
            <p
              className="text-red-400 text-sm text-center font-mono"
              style={{ textShadow: '0 0 8px #ff0000' }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-green-500 hover:bg-green-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold py-3 rounded uppercase tracking-widest font-mono text-sm transition-colors"
          >
            {isLoading ? 'AUTHENTICATING...' : 'LOGIN'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p className="mt-6 text-green-900 text-xs tracking-widest uppercase font-mono">
        Authorized Personnel Only
      </p>
    </div>
  )
}
