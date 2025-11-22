export function checkEnvironmentVariables() {
  const requiredVars = {
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
    VITE_GOOGLE_CLIENT_ID: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    VITE_ENABLE_AUTH: import.meta.env.VITE_ENABLE_AUTH,
    VITE_MOCK_AUTH: import.meta.env.VITE_MOCK_AUTH,
  }

  console.log('🔧 Environment Variables Check:')

  Object.entries(requiredVars).forEach(([key, value]) => {
    const isSet = value && value !== 'undefined'
    const status = isSet ? '✅' : '❌'
    const displayValue = isSet
      ? key.includes('KEY')
        ? `${value.slice(0, 20)}...`
        : value
      : 'NOT SET'
    console.log(`${status} ${key}: ${displayValue}`)
  })

  return requiredVars
}
