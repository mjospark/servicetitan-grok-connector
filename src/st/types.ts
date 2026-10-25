export interface Job {
  id: number;
  number: string;
  status: string;
  summary: string;
  customerName: string;
  customerPhone?: string;
  address: string;
  scheduledStart: string;
  scheduledEnd: string;
  technician: string;
  jobType: string;
  priority: string;
  businessUnit: string;
}

export interface Estimate {
  id: number;
  number: string;
  status: string;
  customerName: string;
  jobId: number | null;
  summary: string;
  total: number;
  createdOn: string;
  expiresOn: string;
}

export interface Invoice {
  id: number;
  number: string;
  status: string;
  customerName: string;
  jobId: number | null;
  total: number;
  balance: number;
  invoiceDate: string;
  dueDate: string;
  daysOverdue: number;
}

export interface Technician {
  id: number;
  name: string;
  active: boolean;
  businessUnit: string;
}

export interface ScheduleGap {
  technician: string;
  date: string;
  gapStart: string;
  gapEnd: string;
  durationMinutes: number;
}

export interface ServiceTitanClient {
  listJobs(fromIso: string, toIso: string): Promise<Job[]>;
  getJob(id: number): Promise<Job | null>;
  listOpenEstimates(): Promise<Estimate[]>;
  listOverdueInvoices(): Promise<Invoice[]>;
  listScheduleGaps(dateIso: string): Promise<ScheduleGap[]>;
}
