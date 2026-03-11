import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

export type TokenStorageMode = 'local' | 'shared' | 'private'

const STORAGE_MODE_KEY = 'claude-token-storage-mode'
const LOCAL_TOKEN_KEY = 'claude-oauth-token'

let tokenCache: string | null = null
let cacheForMode: TokenStorageMode | null = null

export function getTokenStorageMode(): TokenStorageMode {
  const mode = localStorage.getItem(STORAGE_MODE_KEY) as TokenStorageMode | null
  if (mode === 'shared' || mode === 'private') return mode
  return 'local'
}

export function setTokenStorageMode(mode: TokenStorageMode) {
  localStorage.setItem(STORAGE_MODE_KEY, mode)
  invalidateCache()
}

export function invalidateCache() {
  tokenCache = null
  cacheForMode = null
}

// ---------------------------------------------------------------------------
// Low-level per-backend operations
// ---------------------------------------------------------------------------

function readLocal(): string | null {
  return localStorage.getItem(LOCAL_TOKEN_KEY)
}

function writeLocal(token: string) {
  localStorage.setItem(LOCAL_TOKEN_KEY, token)
}

function clearLocal() {
  localStorage.removeItem(LOCAL_TOKEN_KEY)
}

async function readShared(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('user_settings')
    .select('claude_oauth_token')
    .eq('user_id', userId)
    .maybeSingle()
  return data?.claude_oauth_token ?? null
}

async function hasShared(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_settings')
    .select('user_id')
    .eq('user_id', userId)
    .not('claude_oauth_token', 'is', null)
    .maybeSingle()
  if (error) throw error
  return !!data
}

async function writeShared(userId: string, token: string): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, claude_oauth_token: token },
      { onConflict: 'user_id' },
    )
  if (error) throw error
}

async function clearShared(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_settings')
    .update({ claude_oauth_token: null })
    .eq('user_id', userId)
  if (error) throw error
}

async function readPrivate(client: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from('user_secrets')
    .select('claude_oauth_token')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    if (error.message.includes('user_secrets') && error.message.includes('does not exist')) {
      throw new Error('TABLE_MISSING')
    }
    throw error
  }
  return data?.claude_oauth_token ?? null
}

async function hasPrivate(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from('user_secrets')
    .select('user_id')
    .eq('user_id', userId)
    .not('claude_oauth_token', 'is', null)
    .maybeSingle()
  if (error) {
    if (error.message.includes('user_secrets') && error.message.includes('does not exist')) {
      throw new Error('TABLE_MISSING')
    }
    throw error
  }
  return !!data
}

async function writePrivate(client: SupabaseClient, userId: string, token: string): Promise<void> {
  const { error } = await client
    .from('user_secrets')
    .upsert(
      { user_id: userId, claude_oauth_token: token },
      { onConflict: 'user_id' },
    )
  if (error) {
    if (error.message.includes('user_secrets') && error.message.includes('does not exist')) {
      throw new Error('TABLE_MISSING')
    }
    throw error
  }
}

async function clearPrivate(client: SupabaseClient, userId: string): Promise<void> {
  const { error } = await client
    .from('user_secrets')
    .update({ claude_oauth_token: null })
    .eq('user_id', userId)
  if (error) {
    if (error.message.includes('user_secrets') && error.message.includes('does not exist')) {
      throw new Error('TABLE_MISSING')
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// High-level routed operations
// ---------------------------------------------------------------------------

interface TokenOpts {
  userId?: string
  externalClient?: SupabaseClient | null
}

export async function hasStoredToken(opts: TokenOpts): Promise<boolean> {
  const mode = getTokenStorageMode()

  switch (mode) {
    case 'local':
      return !!readLocal()
    case 'shared':
      if (!opts.userId) return false
      return await hasShared(opts.userId)
    case 'private':
      if (!opts.externalClient || !opts.userId) return false
      return await hasPrivate(opts.externalClient, opts.userId)
  }
}

export async function getToken(opts: TokenOpts): Promise<string | null> {
  const mode = getTokenStorageMode()

  if (cacheForMode === mode && tokenCache !== undefined) return tokenCache

  let token: string | null = null

  switch (mode) {
    case 'local':
      token = readLocal()
      break
    case 'shared':
      if (!opts.userId) return null
      token = await readShared(opts.userId)
      break
    case 'private':
      if (!opts.externalClient || !opts.userId) return null
      token = await readPrivate(opts.externalClient, opts.userId)
      break
  }

  tokenCache = token
  cacheForMode = mode
  return token
}

export async function saveToken(token: string, opts: TokenOpts): Promise<void> {
  const mode = getTokenStorageMode()

  switch (mode) {
    case 'local':
      writeLocal(token)
      break
    case 'shared':
      if (!opts.userId) throw new Error('Must be signed in to use shared storage.')
      await writeShared(opts.userId, token)
      break
    case 'private':
      if (!opts.externalClient || !opts.userId) {
        throw new Error('Private backend not configured.')
      }
      await writePrivate(opts.externalClient, opts.userId, token)
      break
  }

  tokenCache = token
  cacheForMode = mode
}

export async function clearToken(opts: TokenOpts): Promise<void> {
  const mode = getTokenStorageMode()

  switch (mode) {
    case 'local':
      clearLocal()
      break
    case 'shared':
      if (!opts.userId) return
      await clearShared(opts.userId)
      break
    case 'private':
      if (!opts.externalClient || !opts.userId) return
      await clearPrivate(opts.externalClient, opts.userId)
      break
  }

  tokenCache = null
  cacheForMode = mode
}

/**
 * Move the token from one storage backend to another.
 * Reads from `from`, writes to `to`, then clears `from`.
 */
export async function migrateToken(
  from: TokenStorageMode,
  to: TokenStorageMode,
  opts: TokenOpts,
): Promise<void> {
  if (from === to) return

  let token: string | null = null

  switch (from) {
    case 'local':
      token = readLocal()
      break
    case 'shared':
      if (opts.userId) token = await readShared(opts.userId)
      break
    case 'private':
      if (opts.externalClient && opts.userId) {
        try {
          token = await readPrivate(opts.externalClient, opts.userId)
        } catch {
          // table missing or other error — nothing to migrate
        }
      }
      break
  }

  if (token) {
    switch (to) {
      case 'local':
        writeLocal(token)
        break
      case 'shared':
        if (opts.userId) await writeShared(opts.userId, token)
        break
      case 'private':
        if (opts.externalClient && opts.userId) {
          await writePrivate(opts.externalClient, opts.userId, token)
        }
        break
    }

    switch (from) {
      case 'local':
        clearLocal()
        break
      case 'shared':
        if (opts.userId) await clearShared(opts.userId)
        break
      case 'private':
        if (opts.externalClient && opts.userId) {
          try {
            await clearPrivate(opts.externalClient, opts.userId)
          } catch {
            // best-effort cleanup
          }
        }
        break
    }
  }

  setTokenStorageMode(to)
}

export const PRIVATE_TABLE_SQL = `-- Run this in your Supabase project's SQL Editor
-- Requires Google auth to be enabled on that project.
CREATE TABLE IF NOT EXISTS user_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  claude_oauth_token text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_secrets: owner"
  ON user_secrets FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());`
