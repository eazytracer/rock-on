import { useState, useEffect } from 'react'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { supabase } from '../lib/supabase'
import { checkEnvironmentVariables } from '../utils/envCheck'
import type { User } from '@supabase/supabase-js'

export function AuthTest() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check environment variables on component mount
    checkEnvironmentVariables()

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-center mb-6">Rock On! Auth Test</h1>
        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          providers={['google']}
          redirectTo={`${window.location.origin}/`}
          theme="light"
        />
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto mt-8 p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold text-center mb-6">🎸 Auth Success!</h1>

      <div className="space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
          <h2 className="font-semibold text-green-800 mb-2">Logged in as:</h2>
          <p className="text-green-700">{user.email}</p>
          <p className="text-sm text-green-600 mt-1">ID: {user.id}</p>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">User Metadata:</h3>
          <pre className="text-xs text-blue-700 whitespace-pre-wrap">
            {JSON.stringify(user.user_metadata, null, 2)}
          </pre>
        </div>

        <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <h3 className="font-semibold text-gray-800 mb-2">Raw User Object:</h3>
          <pre className="text-xs text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {JSON.stringify(user, null, 2)}
          </pre>
        </div>

        <button
          onClick={handleSignOut}
          className="w-full py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}