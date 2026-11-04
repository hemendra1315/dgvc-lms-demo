import type { DemoUser } from './types';

/**
 * DEMO ACCOUNTS — local demonstration only.
 * These are fictional people. The shared password below exists only so the
 * presentation login form has something to validate; it is NOT a security
 * mechanism. Production authentication must use Supabase Auth (see README).
 */
export const DEMO_PASSWORD = 'Demo@2026';

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'u-student-hemu',
    name: 'Hemu',
    email: 'student@demo.dgvc.in',
    role: 'student',
    title: 'Student',
    department: 'Department of Data Science',
    programme: 'B.Sc Data Science',
    year: 'First Year',
    semester: 1,
    registerNo: 'DEMO25DS001',
  },
  {
    id: 'u-faculty-priya',
    name: 'Dr. Priya Raman',
    email: 'faculty@demo.dgvc.in',
    role: 'faculty',
    title: 'Faculty · Python Programming, Statistics',
    department: 'Department of Data Science',
    assignedSubjects: ['python-programming', 'statistics'],
  },
  {
    id: 'u-deptadmin-arjun',
    name: 'Prof. Arjun Menon',
    email: 'deptadmin@demo.dgvc.in',
    role: 'department_admin',
    title: 'Department Admin · Data Science',
    department: 'Department of Data Science',
  },
  {
    id: 'u-admin-super',
    name: 'Super Admin',
    email: 'admin@demo.dgvc.in',
    role: 'super_admin',
    title: 'Super Administrator',
  },
];

export const findUser = (id: string | null | undefined) => DEMO_USERS.find((u) => u.id === id) ?? null;
export const isStaff = (u: DemoUser | null) => !!u && u.role !== 'student';
