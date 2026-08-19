import type {
  ApiResponse,
  PaginatedEmailsResponse,
  PaginationParams,
  ScheduleEmailRequest,
  ScheduleEmailResponse,
} from './types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  const json = (await res.json()) as ApiResponse<T>;

  if (!json.success) {
    throw new Error((json as { success: false; error: string }).error ?? 'API error');
  }

  return (json as { success: true; data: T }).data;
}

// ── Email endpoints ────────────────────────────────────────────────────────────

export async function scheduleEmails(
  payload: ScheduleEmailRequest,
): Promise<ScheduleEmailResponse> {
  return apiFetch<ScheduleEmailResponse>('/api/emails/schedule', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getScheduledEmails(
  params: PaginationParams = {},
): Promise<PaginatedEmailsResponse> {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  return apiFetch<PaginatedEmailsResponse>(`/api/emails/scheduled?${qs}`);
}

export async function getSentEmails(
  params: PaginationParams = {},
): Promise<PaginatedEmailsResponse> {
  const qs = new URLSearchParams({
    page: String(params.page ?? 1),
    pageSize: String(params.pageSize ?? 20),
  });
  return apiFetch<PaginatedEmailsResponse>(`/api/emails/sent?${qs}`);
}

export async function getSenders() {
  return apiFetch<Array<{ id: string; name: string; email: string; hourlyLimit: number | null }>>(
    '/api/emails/senders',
  );
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  return res.json();
}
