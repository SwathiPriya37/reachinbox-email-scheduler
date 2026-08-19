// Shared TypeScript types for the backend

export interface ScheduleEmailRequest {
  subject: string;
  body: string;
  recipients: string[];
  startTime: string; // ISO 8601
  delayBetweenEmailsMs?: number; // ms between consecutive emails; default 0
  hourlyLimit?: number;
  senderId?: string; // defaults to the first seeded sender
}

export interface ScheduleEmailResponse {
  scheduledCount: number;
  jobIds: string[];
  senderId: string;
}

export interface PaginatedEmailsResponse {
  emails: EmailRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledTime: string;
  status: 'PENDING' | 'SENT' | 'FAILED';
  sentTime: string | null;
  bullmqJobId: string | null;
  errorMessage: string | null;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    email: string;
  };
}

export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// BullMQ job data payload
export interface EmailJobData {
  emailId: string;
  senderId: string;
}
