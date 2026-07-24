import React, { createContext, useContext, useEffect, useRef, useState } from 'react'
import { User as SupabaseUser, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { User } from '../types'
import { usersService } from '../lib/services'
import Swal from 'sweetalert2'
import { swalConfig } from '../lib/sweetAlert'

interface AuthContextType {
  user: SupabaseUser | null
  profile: User | null
  session: Session | null
  loading: boolean
  isPendingApproval: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, name: string, username: string, shopName: string) => Promise<{emailConfirmationSent: boolean}>
  signOut: () => Promise<void>
  updateProfile: (updates: Partial<User>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper function to convert auth error messages to user-friendly text
function getAuthErrorMessage(errorMessage: string): string {
  if (errorMessage.includes('Invalid login credentials')) {
    return 'Invalid email or password. Please check your credentials and try again.'
  }
  if (errorMessage.includes('Email not confirmed')) {
    return 'Please check your email and click the confirmation link to activate your account.'
  }
  if (errorMessage.includes('User already registered')) {
    return 'An account with this email already exists. Please sign in instead.'
  }
  if (errorMessage.includes('Password should be at least')) {
    return 'Password must be at least 6 characters long.'
  }
  if (errorMessage.includes('Invalid email')) {
    return 'Please enter a valid email address.'
  }
  if (errorMessage.includes('Too many requests')) {
    return 'Too many attempts. Please wait a few minutes before trying again.'
  }
  if (errorMessage.includes('Network error')) {
    return 'Network connection issue. Please check your internet connection.'
  }
  // Default fallback message
  return 'An unexpected error occurred. Please try again.'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null)
  const [profile, setProfile] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isPendingApproval, setIsPendingApproval] = useState(false)
  // Track which user's profile has been loaded to avoid redundant fetches
  const loadedProfileUserId = useRef<string | null>(null)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        // Skip loadProfile if we already loaded this user's profile (e.g., after signUp)
        // to avoid redundant loading state transitions
        if (loadedProfileUserId.current !== session.user.id) {
          loadedProfileUserId.current = session.user.id
          loadProfile(session.user.id)
        }
      } else {
        setProfile(null)
        setIsPendingApproval(false)
        setLoading(false)
        loadedProfileUserId.current = null
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId: string) {
    loadedProfileUserId.current = userId
    try {
      // Step 1: Load user profile from users table
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error

      if (data) {
        // Step 2: Load shop membership to get canonical role
        // VISION.md §4.2: shop_memberships.role is the canonical role source
        const { data: membership } = await supabase
          .from('shop_memberships')
          .select('shop_id, role, is_active')
          .eq('user_id', userId)
          .eq('is_active', true)
          .limit(1)
          .single()

        // Determine the effective role:
        // - If user has an active shop membership, use that role (canonical)
        // - Otherwise fall back to users.role (for platform_admin who have no membership)
        const effectiveRole = (membership?.role)
          ? membership.role
          : data.role

        setProfile({
          id: data.id,
          username: data.username,
          name: data.name,
          email: data.email,
          role: effectiveRole as User['role'],
          permissions: data.permissions || [],
          active: data.active ?? true,
          lastLogin: data.last_login ? new Date(data.last_login) : undefined,
          avatar: data.avatar || undefined
        })

        setIsPendingApproval(data.active === false)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      Swal.fire({
        icon: 'error',
        title: 'Profile Error',
        text: 'Failed to load user profile. Please try logging in again.',
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 5000,
        timerProgressBar: true
      })
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email: string, password: string) {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      
      // Show success toast with our styled config
      swalConfig.success('Welcome back! You have successfully signed in.');
    } catch (error: unknown) {
      setLoading(false)
      const message = error instanceof Error ? error.message : 'Unknown error';
      // Show error toast with our styled config
      swalConfig.error(`Sign In Failed: ${getAuthErrorMessage(message)}`);
      throw error
    }
  }

  async function signUp(email: string, password: string, name: string, username: string, shopName: string): Promise<{emailConfirmationSent: boolean}> {
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            username,
            shop_name: shopName,
            isPending: true,
          }
        }
      })
      if (error) throw error

      // Detect email confirmation needed: user created but no session (no auto-sign-in)
      const needsConfirmation = !!data.user && !data.session

      if (needsConfirmation) {
        setLoading(false)
        swalConfig.success('Verification email sent! Please check your inbox and click the link to verify your account.')
        // Track the user ID so onAuthStateChange doesn't attempt to load profile
        loadedProfileUserId.current = data.user.id
        return { emailConfirmationSent: true }
      }

      // Profile row auto-created by DB trigger handle_new_auth_user().
      // Fetch the trigger-created profile instead of inserting.
      if (data.user) {
        // Step 1: Load user profile from users table
        const { data: profileData, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single()

        if (profileError) {
          console.error('Profile fetch error:', profileError)
          throw new Error(`Failed to load user profile: ${profileError.message}`)
        }

        // Set the profile data immediately
        if (profileData) {
          // Step 2: Load shop membership to get canonical role
          // VISION.md §4.2: shop_memberships.role is the canonical role source
          const { data: membership } = await supabase
            .from('shop_memberships')
            .select('shop_id, role, is_active')
            .eq('user_id', profileData.id)
            .eq('is_active', true)
            .limit(1)
            .single()

          // Determine the effective role:
          // - If user has an active shop membership, use that role (canonical)
          // - Otherwise fall back to users.role (for platform_admin who have no membership)
          const effectiveRole = (membership?.role)
            ? membership.role
            : profileData.role

          setProfile({
            id: profileData.id,
            username: profileData.username,
            name: profileData.name,
            email: profileData.email,
            role: effectiveRole as User['role'],
            permissions: profileData.permissions || [],
            active: profileData.active ?? true,
            lastLogin: profileData.last_login ? new Date(profileData.last_login) : undefined,
            avatar: profileData.avatar || undefined
          })

          // Set pending approval state for inactive users (DB trigger creates with active=false)
          setIsPendingApproval(profileData.active === false)

          // Mark profile as loaded so onAuthStateChange doesn't re-fetch
          loadedProfileUserId.current = profileData.id
        }
      }

      setLoading(false)

      // Show success toast with our styled config
      swalConfig.success('Account Created! Your account has been created successfully.');
      return { emailConfirmationSent: false }
    } catch (error: unknown) {
      setLoading(false)
      const message = error instanceof Error ? error.message : 'Unknown error';
      // Show error toast with our styled config
      swalConfig.error(`Sign Up Failed: ${getAuthErrorMessage(message)}`);
      throw error
    }
  }

  async function signOut() {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      
      // Show success toast with our styled config
      swalConfig.success('Signed Out! You have been successfully signed out.');
    } catch (error: unknown) {
      setLoading(false)
      const message = error instanceof Error ? error.message : 'Unknown error';
      // Show error toast with our styled config
      swalConfig.error(`Sign Out Failed: ${getAuthErrorMessage(message)}`);
      throw error
    }
  }

  async function updateProfile(updates: Partial<User>) {
    if (!user) throw new Error('No user logged in')
    const updatedProfile = await usersService.update(user.id, updates)
    setProfile(updatedProfile)
  }

  const value = {
    user,
    profile,
    session,
    loading,
    isPendingApproval,
    signIn,
    signUp,
    signOut,
    updateProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
