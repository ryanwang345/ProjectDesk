import Keycloak from 'keycloak-js'

type AuthConfig = { enabled: boolean; url?: string; realm?: string; clientId?: string }
export type AuthState = {
  status: 'loading' | 'authenticated' | 'anonymous' | 'disabled' | 'error'
  name?: string
  error?: string
}

let state: AuthState = { status: 'loading' }
let client: Keycloak | undefined
let initialization: Promise<void> | undefined
const listeners = new Set<() => void>()

function publish(next: AuthState) {
  state = next
  listeners.forEach((listener) => listener())
}

function signedIn() {
  publish({
    status: 'authenticated',
    name: client?.tokenParsed?.name || client?.tokenParsed?.preferred_username || 'Account',
  })
}

function endSession() {
  client?.clearToken()
  publish({ status: 'anonymous' })
}

export const getAuthState = () => state
export function subscribeAuth(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

// A single promise makes initialization safe under React StrictMode. The gate
// mounts the router only after Keycloak has consumed its callback parameters.
export function initializeAuth(): Promise<void> {
  initialization ??= (async () => {
    try {
      const response = await fetch('/api/auth/config', { cache: 'no-store', signal: AbortSignal.timeout(10000) })
      if (!response.ok) throw new Error('Sign-in configuration is unavailable. Please try again.')
      const config = await response.json() as AuthConfig
      if (config.enabled === false) {
        publish({ status: 'disabled' })
        return
      }
      if (config.enabled !== true || !config.url || !config.realm || !config.clientId) {
        throw new Error('Sign-in is not configured. Please contact the app administrator.')
      }
      client = new Keycloak({ url: config.url, realm: config.realm, clientId: config.clientId })
      client.onAuthLogout = () => publish({ status: 'anonymous' })
      client.onAuthRefreshError = endSession
      client.onTokenExpired = () => { void refreshAccessToken().catch(() => {}) }
      const authenticated = await client.init({
        onLoad: 'check-sso',
        pkceMethod: 'S256',
        flow: 'standard',
        checkLoginIframe: false,
        messageReceiveTimeout: 10000,
      })
      if (authenticated) signedIn()
      else publish({ status: 'anonymous' })
    } catch {
      client?.clearToken()
      publish({ status: 'error', error: 'Unable to connect to sign-in. Check that the API and Keycloak are running, then try again.' })
    }
  })()
  return initialization
}

export async function signIn() {
  try {
    const redirectUri =
      window.location.pathname === '/register'
        ? `${window.location.origin}/`
        : window.location.href
    await client?.login({ redirectUri })
  } catch {
    publish({ status: 'error', error: 'Unable to open sign-in. Please try again.' })
  }
}

export async function registerAccount() {
  try {
    await client?.register({ redirectUri: `${window.location.origin}/` })
  } catch {
    publish({ status: 'error', error: 'Unable to open Keycloak registration. Please verify user registration is enabled on your realm.' })
  }
}

export async function signOut() {
  try {
    await client?.logout({ redirectUri: window.location.origin + '/' })
  } catch {
    endSession()
    publish({ status: 'error', error: 'Unable to finish signing out. Please retry to end your Keycloak session.' })
  }
}

async function refreshAccessToken(): Promise<string> {
  if (!client?.authenticated) throw new Error('Sign in to continue.')
  try {
    await client.updateToken(30)
    if (!client.token) throw new Error('No access token')
    return client.token
  } catch {
    endSession()
    throw new Error('Your session expired. Please sign in again.')
  }
}

/** Attach credentials only to this origin's API, never external dictionary/audio URLs. */
export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) {
    throw new Error('Authenticated requests must target this app’s API.')
  }
  await initializeAuth()
  const headers = new Headers(init?.headers)
  if (state.status !== 'disabled') {
    headers.set('Authorization', `Bearer ${await refreshAccessToken()}`)
  }
  const response = await fetch(input, { ...init, headers })
  if (response.status === 401 && response.headers.has('WWW-Authenticate') && state.status !== 'disabled') {
    endSession()
    throw new Error('Your session expired. Please sign in again.')
  }
  return response
}
