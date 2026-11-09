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
