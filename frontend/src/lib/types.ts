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
