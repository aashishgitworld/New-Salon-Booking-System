export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: 'admin' | 'staff' | 'customer';
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Service {
  id: string;
  name: string;
  description: string | null;
  category: 'hair' | 'nails' | 'massage' | 'spa' | 'facial' | 'other';
  durationMinutes: number;
  price: number | string;
  isActive: boolean;
}

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show';

export interface Appointment {
  id: string;
  customerId: string | null;
  serviceId: string;
  service: Service;
  customer?: User;
  startTime: string;
  endTime: string;
  status: AppointmentStatus;
  notes: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TimeSlot {
  startTime: string;
  endTime: string;
  available: boolean;
  reason?: 'break' | 'booked' | 'past' | 'closed';
}

export interface AvailableSlotsResponse {
  date: string;
  service: { id: string; name: string; durationMinutes: number };
  slots: TimeSlot[];
}

export type TemplateType =
  | 'confirmation'
  | 'reminder'
  | 'cancellation'
  | 'reschedule';

export interface NotificationTemplate {
  id: string;
  name: string;
  type: TemplateType;
  subject: string;
  body: string;
  description: string | null;
  isActive: boolean;
}

export type NotificationStatus =
  | 'pending'
  | 'processing'
  | 'success'
  | 'failed';

export interface NotificationLog {
  id: string;
  batchId: string | null;
  jobId: string | null;
  recipient: string;
  recipientName: string | null;
  subject: string;
  body: string;
  channel: 'email' | 'sms';
  status: NotificationStatus;
  errorMessage: string | null;
  sentAt: string | null;
  template: NotificationTemplate | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
}

export interface PaginatedData<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface BulkProgressPayload {
  batchId: string;
  total: number;
  processed: number;
  success: number;
  failed: number;
  status: 'started' | 'processing' | 'completed';
  lastRow?: {
    row: number;
    success: boolean;
    recipient: string;
    error?: string;
  };
}
