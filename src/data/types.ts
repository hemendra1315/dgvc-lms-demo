export type Role = 'student' | 'faculty' | 'department_admin' | 'super_admin';
export type ResourceStatus = 'draft' | 'published' | 'unpublished' | 'archived';

export interface PaperSection {
  part: string;
  title: string;
  questions: number;
  answer: number;
  marks_each: number;
  total: number;
}

/** A question-paper resource record (mirrors public.pyq_demo_resources). */
export interface PyqResource {
  id: string;
  title: string;
  description: string;
  subject: string;
  subject_key: string;
  subject_code: string;
  department: string;
  programme: string;
  semester: number;
  exam_year: number;
  exam_month: string;
  exam_type: string;
  exam_date: string;
  max_marks: number;
  duration: string;
  sections: PaperSection[];
  file_url: string;
  file_name: string;
  file_size: number;
  page_count: number;
  mime_type: string;
  resource_type: 'question_paper';
  status: ResourceStatus;
  demo_label: string;
  is_demo: boolean;
  created_at: string;
  updated_at?: string;
}

export interface DemoUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  title: string;
  department?: string;
  programme?: string;
  year?: string;
  semester?: number;
  registerNo?: string;
  /** Faculty only: subject keys this person may manage. */
  assignedSubjects?: string[];
}

export interface ActivityItem { id: string; at: string }

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  entity: string;
  detail?: string;
}

export interface DemoState {
  version: string;
  resources: PyqResource[];
  bookmarks: Record<string, string[]>;
  downloads: Record<string, ActivityItem[]>;
  recent: Record<string, ActivityItem[]>;
  audit: AuditEntry[];
  sessionUserId: string | null;
}

export interface PyqFilters {
  q?: string;
  subject?: string;
  semester?: number;
  year?: number;
  examType?: string;
  department?: string;
  programme?: string;
  status?: ResourceStatus | 'all';
}

export type SortKey = 'latest' | 'oldest' | 'az';
