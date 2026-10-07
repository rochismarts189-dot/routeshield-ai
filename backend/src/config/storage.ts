import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';

let supabaseClient: SupabaseClient | null = null;
const memoryStore = new Map<string, { buffer: Buffer; contentType: string }>();

function getStorageClient(): SupabaseClient | null {
  if (supabaseClient) return supabaseClient;
  if (env.SUPABASE_URL && env.SUPABASE_SECRET_KEY) {
    supabaseClient = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    return supabaseClient;
  }
  return null;
}

export async function uploadEvidencePhoto(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const client = getStorageClient();
  if (client) {
    const { error } = await client.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .upload(key, buffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      throw new Error(`Supabase Storage upload failed: ${error.message}`);
    }
  } else {
    // In-memory fallback when Supabase credentials are not configured
    memoryStore.set(key, { buffer, contentType });
  }
}

export async function getSignedPhotoUrl(
  key: string,
  expiresInSeconds: number = 3600
): Promise<string> {
  const client = getStorageClient();
  if (client) {
    const { data, error } = await client.storage
      .from(env.SUPABASE_STORAGE_BUCKET)
      .createSignedUrl(key, expiresInSeconds);

    if (error || !data) {
      throw new Error(`Failed to create signed URL: ${error?.message || 'unknown'}`);
    }
    return data.signedUrl;
  } else {
    // In-memory fallback
    const item = memoryStore.get(key);
    if (item) {
      return `data:${item.contentType};base64,${item.buffer.toString('base64')}`;
    }
    return `/placeholder-evidence/${key}`;
  }
}
