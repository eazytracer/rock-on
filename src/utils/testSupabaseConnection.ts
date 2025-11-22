/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseClient } from '../services/supabase/client'
import { config } from '../config/appMode'

/**
 * Test Supabase connection and display results in console
 * Call this function from browser console: testSupabaseConnection()
 */
export async function testSupabaseConnection() {
  console.log('🧪 Testing Supabase connection...')

  if (!config.isProduction) {
    console.log('❌ Not in production mode')
    console.log('📝 Current config:', {
      mode: config.mode,
      isProduction: config.isProduction,
      enableSupabaseAuth: config.enableSupabaseAuth,
      supabaseUrl: config.supabaseUrl,
    })
    return
  }

  try {
    const supabase = getSupabaseClient()

    console.log('✅ Supabase client initialized')
    console.log('📡 Supabase URL:', config.supabaseUrl)

    // Test 1: Check auth session
    console.log('\n📋 Test 1: Checking auth session...')
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession()

    if (sessionError) {
      console.log('⚠️  Session error:', sessionError.message)
    } else if (sessionData.session) {
      console.log('✅ Active session found')
      console.log('👤 User:', sessionData.session.user.email)
    } else {
      console.log('ℹ️  No active session (user not logged in)')
    }

    // Test 2: Try to read from bands table (will fail with RLS if not authenticated)
    console.log('\n📋 Test 2: Testing database access...')
    const { data: bandsData, error: bandsError } = await supabase
      .from('bands')
      .select('id, name')
      .limit(1)

    if (bandsError) {
      if (bandsError.code === 'PGRST116') {
        console.log('✅ RLS is working (blocked unauthorized access)')
        console.log('ℹ️  This is expected when not logged in')
      } else {
        console.log('⚠️  Database error:', bandsError.message)
      }
    } else {
      console.log('✅ Database access successful')
      console.log('📊 Bands found:', bandsData?.length || 0)
      if (bandsData && bandsData.length > 0) {
        console.log('🎸 Sample band:', bandsData[0])
      }
    }

    // Test 3: Check connection status
    console.log('\n📋 Test 3: Connection status...')
    console.log('🌐 Online:', navigator.onLine)
    console.log('📡 Supabase connected:', !!supabase)

    console.log('\n✅ Supabase connection test complete!')
    console.log('\n💡 Next steps:')
    console.log('1. Try signing up with email/password')
    console.log('2. Check Supabase dashboard to see if user was created')
    console.log('3. Sign in and create some data')
    console.log('4. Verify data appears in Supabase dashboard')
  } catch (error) {
    console.error('❌ Supabase connection test failed:', error)
  }
}

// Make it available globally for console testing
if (typeof window !== 'undefined') {
  ;(window as any).testSupabaseConnection = testSupabaseConnection
}
