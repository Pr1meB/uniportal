export type Role = "SUPER_ADMIN" | "DEPT_ADMIN" | "LECTURER" | "STUDENT";
export type SheetStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
export type Dec = string | number | null;

export interface Me {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: Role;
  role_display: string;
  department: { id: number; name: string; code: string; faculty: string } | null;
  status: AccountStatus;
  must_change_password: boolean;
  last_login: string | null;
  student_profile: StudentProfile | null;
  lecturer_profile: LecturerProfile | null;
}

export interface StudentProfile {
  matric_number: string;
  program: number;
  program_name: string;
  level: number;
  level_display: string;
  entry_session: number | null;
  entry_session_name: string | null;
  date_of_birth: string | null;
  gender: string;
  address: string;
  next_of_kin: string;
  next_of_kin_phone: string;
}

export interface LecturerProfile {
  staff_id: string;
  title: string;
  rank: string;
  specialization: string;
  office: string;
}

export interface Semester {
  id: number;
  session: number;
  session_name: string;
  term: "FIRST" | "SECOND";
  term_display: string;
  label: string;
  is_current: boolean;
  registration_open: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface Course {
  id: number;
  code: string;
  title: string;
  units: number;
  level: number;
  level_display: string;
  term: "FIRST" | "SECOND";
  term_display: string;
  description: string;
  is_elective: boolean;
  is_active: boolean;
  department: number;
  department_name: string;
  programs: number[];
  program_names: string[];
}

export interface LecturerMini {
  id: number;
  full_name: string;
  email: string;
  staff_id: string | null;
}

export interface Offering {
  id: number;
  course: number;
  course_detail: Course;
  semester: number;
  semester_label: string;
  lecturers: number[];
  lecturer_details: LecturerMini[];
  capacity: number | null;
  registered_count: number;
  result_status: SheetStatus | null;
  is_registered?: boolean;
}

export interface Registration {
  id: number;
  offering: number;
  course_code: string;
  course_title: string;
  units: number;
  level: number;
  semester: number;
  semester_label: string;
  student: number;
  student_name: string;
  matric_number: string;
  student_level: number;
  program: string;
  lecturers: string[];
  result_status: SheetStatus | null;
  created_at: string;
}

export interface ResultRow {
  id: number;
  registration: number;
  student_name: string;
  matric_number: string;
  level: number;
  ca_score: Dec;
  exam_score: Dec;
  total: Dec;
  grade: string;
  grade_point: Dec;
  updated_at: string;
}

export interface Sheet {
  id: number;
  offering: Offering;
  status: SheetStatus;
  status_display: string;
  submitted_by_name: string | null;
  submitted_at: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  review_comment: string;
  revision: number;
  student_count: number | null;
  average: Dec;
  pass_count: number | null;
  updated_at: string;
}

export interface HistoryEntry {
  id: number;
  action: string;
  summary: string;
  changes: Record<string, unknown>;
  created_at: string;
  actor__first_name: string | null;
  actor__last_name: string | null;
  actor_role: string;
}

export interface SheetPayload {
  sheet: Sheet;
  rows: ResultRow[];
  summary: {
    count: number;
    avg: Dec;
    high: Dec;
    low: Dec;
    passed: number;
    failed: number;
    entered: number;
    distribution: Record<string, number>;
  };
  history: HistoryEntry[];
}

export interface TranscriptCourse {
  code: string;
  title: string;
  units: number;
  ca_score: Dec;
  exam_score: Dec;
  total: Dec;
  grade: string;
  grade_point: Dec;
}

export interface TranscriptSemester {
  semester_id: number;
  session: string;
  term: string;
  label: string;
  courses: TranscriptCourse[];
  units: number;
  units_passed: number;
  gpa: Dec;
  cgpa: Dec;
}

export interface Transcript {
  semesters: TranscriptSemester[];
  cgpa: Dec;
  total_units: number;
  units_passed: number;
  degree_class: string;
}

export interface AuditEntry {
  id: number;
  created_at: string;
  actor: number | null;
  actor_name: string;
  actor_email: string | null;
  actor_role: string;
  action: string;
  action_display: string;
  entity_type: string;
  entity_id: string;
  department: number | null;
  department_name: string | null;
  summary: string;
  changes: Record<string, unknown>;
  ip_address: string | null;
}

export interface Lookups {
  current_semester: Semester | null;
  faculties: { id: number; name: string; code: string }[];
  departments: { id: number; name: string; code: string; faculty: number }[];
  programs: { id: number; name: string; code: string; department: number; levels: number[] }[];
  levels: { value: number; label: string }[];
  terms: { value: string; label: string }[];
  semesters: Semester[];
  grading: {
    ca_max: number;
    exam_max: number;
    max_units: number;
    bands: { grade: string; min_score: Dec; max_score: Dec; point: Dec; remark: string }[];
  };
}
