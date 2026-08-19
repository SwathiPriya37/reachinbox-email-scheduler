// ─────────────────────────────────────────────────────────────────────────────
// Shared TypeScript types — used in both API layer and component props
// ─────────────────────────────────────────────────────────────────────────────

export type EmailStatus = 'PENDING' | 'SENT' | 'FAILED';

export interface SenderInfo {
  id: string;
  name: string;
  email: string;
}

export interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledTime: string;
  status: EmailStatus;
  sentTime: string | null;
  bullmqJobId: string | null;
  errorMessage: string | null;
  createdAt: string;
  sender: SenderInfo;
}

export interface PaginatedEmailsResponse {
  emails: EmailRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO 8601
  delayBetweenEmailsMs?: number;
  hourlyLimit?: number;
  senderId?: string;
}

export interface ScheduleEmailResponse {
  scheduledCount: number;
  jobIds: string[];
  senderId: string;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Pagination query params ──────────────────────────────────────────────────
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}
