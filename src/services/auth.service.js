import pool from "../config/db.js";

// ==========================================
// HELPER 1: THE REUSABLE SQL QUERY
// ==========================================
// We explicitly list the user fields to ensure both login and getUserById get the exact same data.
const BASE_USER_QUERY = `
  SELECT 
    u.id, u.fullname, u.email, u.password, u.role_id, u.payrate, u.position, u.branch, u."isActive", u.profile_picture, u.daily_rate,
    u.date_of_birth, u.place_of_birth, u.gender, u.civil_status, u.residential_address, u.contact_number, 
    u.employee_id, u.employment_type, u.date_hired, u.sss_number, u.philhealth_number, u.pag_ibig_number, u.tin_number, 
    u.bank_name, u.bank_account_number, u.emergency_contact_name, u.emergency_contact_number, u.emergency_relationship,
    r.role_name,
    -- Employee
    r.perm_employee_view, r.perm_employee_create, r.perm_employee_edit, r.perm_employee_delete,
    -- Attendance
    r.perm_attendance_view, r.perm_attendance_verify, r.perm_attendance_manual, r.perm_attendance_export,
    -- Leave
    r.perm_leave_view, r.perm_leave_view_all, r.perm_leave_approve, r.perm_leave_create, r.perm_leave_manage,
    -- Overtime
    r.perm_overtime_view, r.perm_overtime_view_all, r.perm_overtime_approve, r.perm_overtime_create, r.perm_overtime_manage,
    -- Deduction
    r.perm_deduction_view, r.perm_deduction_manage,
    -- Allowance
    r.perm_allowance_view, r.perm_allowance_manage,
    -- Dashboard
    r.perm_dashboard_view,
    -- Payroll
    r.perm_payroll_view, r.perm_payroll_view_all, r.perm_payroll_manage, r.perm_payroll_approve,
    -- Role Management
    r.perm_role_view, r.perm_role_manage
  FROM users u 
  LEFT JOIN roles r ON u.role_id = r.id
`;

// ==========================================
// HELPER 2: THE DATA CLEANER
// ==========================================
const formatUserRecord = (user) => {
  // 1. Remove password for security
  delete user.password;

  // 2. Group all role permissions into a neat nested "role" object
  user.role = {
    id: user.role_id,
    name: user.role_name,
    // Employee
    perm_employee_view: user.perm_employee_view,
    perm_employee_create: user.perm_employee_create,
    perm_employee_edit: user.perm_employee_edit,
    perm_employee_delete: user.perm_employee_delete,
    // Attendance
    perm_attendance_view: user.perm_attendance_view,
    perm_attendance_verify: user.perm_attendance_verify,
    perm_attendance_manual: user.perm_attendance_manual,
    perm_attendance_export: user.perm_attendance_export,
    // Leave
    perm_leave_view: user.perm_leave_view,
    perm_leave_view_all: user.perm_leave_view_all,
    perm_leave_approve: user.perm_leave_approve,
    perm_leave_create: user.perm_leave_create,
    perm_leave_manage: user.perm_leave_manage,
    // Overtime
    perm_overtime_view: user.perm_overtime_view,
    perm_overtime_view_all: user.perm_overtime_view_all,
    perm_overtime_approve: user.perm_overtime_approve,
    perm_overtime_create: user.perm_overtime_create,
    perm_overtime_manage: user.perm_overtime_manage,
    // Deduction
    perm_deduction_view: user.perm_deduction_view,
    perm_deduction_manage: user.perm_deduction_manage,
    // Allowance
    perm_allowance_view: user.perm_allowance_view,
    perm_allowance_manage: user.perm_allowance_manage,
    // Dashboard
    perm_dashboard_view: user.perm_dashboard_view,
    // Payroll
    perm_payroll_view: user.perm_payroll_view,
    perm_payroll_view_all: user.perm_payroll_view_all,
    perm_payroll_manage: user.perm_payroll_manage,
    perm_payroll_approve: user.perm_payroll_approve,
    // Role
    perm_role_view: user.perm_role_view,
    perm_role_manage: user.perm_role_manage,
  };

  // 3. CLEANUP: Delete the raw duplicate keys from the root object
  delete user.role_name;
  Object.keys(user).forEach((key) => {
    if (key.startsWith("perm_")) {
      delete user[key];
    }
  });

  return user;
};

// ==========================================
// 1. LOGIN USER
// ==========================================
export const loginUser = async (email, password) => {
  const query = `${BASE_USER_QUERY} WHERE u.email = $1`;
  const result = await pool.query(query, [email]);

  if (result.rows.length === 0) throw new Error("Invalid Credentials");

  const user = result.rows[0];

  if (password !== user.password) throw new Error("Invalid Credentials");

  return formatUserRecord(user);
};

// ==========================================
// 2. GET USER BY ID (Used for Check Auth)
// ==========================================
export const getUserById = async (userId) => {
  const query = `${BASE_USER_QUERY} WHERE u.id = $1`;
  const result = await pool.query(query, [userId]);

  if (result.rows.length === 0) throw new Error("User not found");

  return formatUserRecord(result.rows[0]);
};