export function analysisFailureMessage(code: string | null): string {
  if (code === 'TIMEOUT') return 'Gemini’s request timed out. Your evidence is saved for a later retry.';
  if (code === 'PROVIDER_UNAVAILABLE') return 'Gemini is temporarily unavailable. Your evidence is saved; no AI result has been invented.';
  if (code === 'MODEL_UNAVAILABLE') return 'The configured Gemini model is unavailable to this account. Your evidence is saved for a later retry.';
  if (code === 'QUOTA_EXCEEDED') return 'Gemini’s request quota was reached. Your evidence is saved for a later retry.';
  if (code === 'PROVIDER_AUTH_FAILURE') return 'Gemini rejected the backend credentials. Your evidence is saved; the backend configuration needs attention.';
  return 'Gemini could not complete a validated analysis. Your evidence is saved and remains subject to verification.';
}
