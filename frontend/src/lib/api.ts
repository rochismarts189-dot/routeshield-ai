import {
  Node,
  Edge,
  RoutePlan,
  RoutingProfile,
  IncidentSummary,
  IncidentDetail,
  User,
} from '../types';

export function resolveApiBaseUrl(value: string | undefined, production: boolean): string {
  if (!value?.trim()) {
    if (production) throw new ApiError('Set VITE_API_BASE_URL to the Render backend URL in Vercel, then redeploy.', 'BACKEND_NOT_CONFIGURED');
    return ''; // Vite proxies /api in development.
  }
  let parsed: URL;
  try { parsed = new URL(value.trim()); } catch { throw new ApiError('The backend URL is invalid.', 'BACKEND_NOT_CONFIGURED'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash ||
    (production && (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))) {
    throw new ApiError('Production requires a public HTTPS backend URL.', 'BACKEND_NOT_CONFIGURED');
  }
  return parsed.toString().replace(/\/$/, '').replace(/\/api$/, '');
}

let inMemoryToken: string | null = null;

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export class ApiError extends Error {
  code: string;
  details?: any;

  constructor(message: string, code: string = 'API_ERROR', details?: any) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD)}${path}`;
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (inMemoryToken) {
    headers['Authorization'] = `Bearer ${inMemoryToken}`;
  }

  // Do not set Content-Type if FormData (browser sets boundary automatically)
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  let response: Response;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err: any) {
    throw new ApiError(
      'Unable to connect to the backend. Retry after the Render service wakes up; check its API URL and allowed frontend origin.',
      controller.signal.aborted ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR'
    );
  } finally { clearTimeout(timeout); }

  const isJson = response.headers.get('content-type')?.includes('application/json');
  if (!isJson) throw new ApiError('The API returned a web page instead of JSON. Check VITE_API_BASE_URL points to Render.', 'INVALID_API_RESPONSE');
  const data = await response.json();

  if (!response.ok) {
    if (response.status === 401 && inMemoryToken) { setAuthToken(null); window.dispatchEvent(new Event('routeshield:session-expired')); }
    const errorPayload = data?.error;
    const msg = errorPayload?.message || `Request failed with status ${response.status}`;
    const code = errorPayload?.code || `HTTP_${response.status}`;
    throw new ApiError(msg, code, errorPayload?.details);
  }

  return data as T;
}

export const api = {
  // Public
  getHealth: () => request<{ status: string }>('/api/health'),
  getNetwork: () => request<{ nodes: Node[]; edges: Edge[] }>('/api/network'),
  planRoute: (originId: string, destinationId: string, profile: RoutingProfile) =>
    request<RoutePlan>('/api/routes/plan', {
      method: 'POST',
      body: JSON.stringify({ originId, destinationId, profile }),
    }),
  getIncidents: (filters: { status?: string; edgeId?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.edgeId) params.set('edgeId', filters.edgeId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request<{ incidents: IncidentSummary[] }>(`/api/incidents${query}`);
  },
  getIncident: (id: string) => request<{ incident: IncidentDetail }>(`/api/incidents/${id}`),

  // Auth
  register: (payload: { email: string; displayName: string; password: string }) =>
    request<{ user: User; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  login: (payload: { email: string; password: string }) =>
    request<{ user: User; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getMe: () => request<{ user: User }>('/api/auth/me'),

  // Reports
  submitReport: (formData: FormData) =>
    request<{
      reportId: string;
      incidentId: string;
      analysisStatus: string;
      incidentStatus: string;
      analysis: any;
      errorCode: string | null;
    }>('/api/reports', {
      method: 'POST',
      body: formData,
    }),
  retryAnalysis: (reportId: string) =>
    request<{
      reportId: string;
      analysisStatus: string;
      incidentStatus: string;
      analysis: any;
      errorCode: string | null;
    }>(`/api/reports/${reportId}/retry-analysis`, {
      method: 'POST',
    }),
  excludeReport: (reportId: string, reason: string) =>
    request<{ message: string; reportId: string; incidentStatus: string }>(
      `/api/reports/${reportId}/exclude`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }
    ),

  // Moderation
  verifyIncident: (
    incidentId: string,
    payload: {
      action: 'CONFIRM_BLOCKED' | 'CLEAR' | 'DISMISS';
      evidenceReportId?: string;
      blockedProfiles?: ('GENERAL_WALK' | 'STEP_FREE')[];
      expectedVersion: number;
      attestation?: boolean;
      reason: string;
    }
  ) =>
    request<{
      message: string;
      incident: Partial<IncidentSummary>;
    }>(`/api/incidents/${incidentId}/verify`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
