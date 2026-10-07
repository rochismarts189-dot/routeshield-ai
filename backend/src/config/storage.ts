import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from './env.js';
import { AppError } from '../lib/errors.js';

let client: SupabaseClient | null = null;
let privateBucketVerified = false;
export function getStorageClient(): SupabaseClient {
  if (!env.SUPABASE_URL || !env.SUPABASE_SECRET_KEY) throw new AppError(503, 'STORAGE_NOT_CONFIGURED', 'Configure backend Supabase credentials and a private evidence bucket.');
  client ??= createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}
export async function verifyPrivateEvidenceBucket(): Promise<void> {
  if (privateBucketVerified) return;
  const { data, error } = await getStorageClient().storage.getBucket(env.SUPABASE_STORAGE_BUCKET);
  if (error || !data) throw new AppError(503, 'EVIDENCE_BUCKET_UNAVAILABLE', 'Create the private evidence bucket and check backend Storage credentials.');
  if (data.public) throw new AppError(503, 'EVIDENCE_BUCKET_PUBLIC', 'The evidence bucket must be private before reporting can be enabled.');
  privateBucketVerified = true;
}
export async function uploadEvidencePhoto(key: string, buffer: Buffer, contentType: string): Promise<void> {
  await verifyPrivateEvidenceBucket();
  const { error } = await getStorageClient().storage.from(env.SUPABASE_STORAGE_BUCKET).upload(key, buffer, { contentType, upsert: false });
  if (error) throw new AppError(502, 'EVIDENCE_UPLOAD_FAILED', 'Evidence could not be stored. Please retry.');
}
export async function removeEvidencePhoto(key: string): Promise<void> {
  const { error } = await getStorageClient().storage.from(env.SUPABASE_STORAGE_BUCKET).remove([key]);
  if (error) console.warn('[storage] Orphan evidence cleanup failed.');
}
export async function getSignedPhotoUrl(key: string, expiresInSeconds = 600): Promise<string> {
  await verifyPrivateEvidenceBucket();
  const { data, error } = await getStorageClient().storage.from(env.SUPABASE_STORAGE_BUCKET).createSignedUrl(key, expiresInSeconds);
  if (error || !data) throw new AppError(502, 'EVIDENCE_UNAVAILABLE', 'Evidence preview is temporarily unavailable.');
  return data.signedUrl;
}
export async function getEvidencePhotoBuffer(key: string): Promise<Buffer> {
  await verifyPrivateEvidenceBucket();
  const { data, error } = await getStorageClient().storage.from(env.SUPABASE_STORAGE_BUCKET).download(key);
  if (error || !data) throw new AppError(502, 'EVIDENCE_UNAVAILABLE', 'Stored evidence could not be retrieved.');
  return Buffer.from(await data.arrayBuffer());
}
