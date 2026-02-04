import pool from "../config/db.js";

export const registerUser = async (userData) => {
  const { fullname, email, password, role_id, payrate, position, branch } = userData;

  // 1. Check if user exists
  const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  if (userCheck.rows.length > 0) {
    throw new Error("User already exists!");
  }

  // 2. Insert User
  const result = await pool.query(
    "INSERT INTO users (fullname, email, password, role_id, payrate, position, branch) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, fullname, email, role_id",
    [fullname, email, password, role_id, payrate, position, branch]
  );

  return result.rows[0];
};

export const loginUser = async (email, password) => {
  const query = `
    SELECT 
      u.*, 
      r.role_name,
      -- Employee
      r.perm_employee_view,
      r.perm_employee_create,
      r.perm_employee_edit,
      r.perm_employee_delete,
      -- Attendance
      r.perm_attendance_view,
      r.perm_attendance_verify,
      r.perm_attendance_manual,
      r.perm_attendance_export,
      -- Leave
      r.perm_leave_view, 
      r.perm_leave_view_all, 
      r.perm_leave_approve,
      -- Overtime
      r.perm_overtime_view,
      r.perm_overtime_view_all,
      r.perm_overtime_approve,
      -- Payroll
      r.perm_payroll_view,
      r.perm_payroll_manage,
      -- Role Management (NEW)
      r.perm_role_view,
      r.perm_role_manage
    FROM users u 
    LEFT JOIN roles r ON u.role_id = r.id 
    WHERE u.email = $1
  `;
  
  const result = await pool.query(query, [email]);

  if (result.rows.length === 0) throw new Error("Invalid Credentials");

  const user = result.rows[0];

  if (password !== user.password) throw new Error("Invalid Credentials");

  delete user.password;

  // Transform role object
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
    // Overtime
    perm_overtime_view: user.perm_overtime_view,
    perm_overtime_view_all: user.perm_overtime_view_all,
    perm_overtime_approve: user.perm_overtime_approve,
    // Payroll
    perm_payroll_view: user.perm_payroll_view,
    perm_payroll_manage: user.perm_payroll_manage,
    // Role Management
    perm_role_view: user.perm_role_view,
    perm_role_manage: user.perm_role_manage,
  };

  return user;
};

export const getUserById = async (userId) => {
  const result = await pool.query(
    `SELECT 
      u.id, u.fullname, u.email, u.role_id, u.payrate, u.position, u.branch, u."isActive", u.profile_picture,
      r.role_name,
      -- Employee
      r.perm_employee_view, r.perm_employee_create, r.perm_employee_edit, r.perm_employee_delete,
      -- Attendance
      r.perm_attendance_view, r.perm_attendance_verify, r.perm_attendance_manual, r.perm_attendance_export,
      -- Leave
      r.perm_leave_view, r.perm_leave_view_all, r.perm_leave_approve,
      -- Overtime
      r.perm_overtime_view, r.perm_overtime_view_all, r.perm_overtime_approve,
      -- Payroll
      r.perm_payroll_view, r.perm_payroll_manage,
      -- Role Management
      r.perm_role_view, r.perm_role_manage
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) throw new Error("User not found");

  const user = result.rows[0];

  user.role = {
    id: user.role_id,
    name: user.role_name,
    perm_employee_view: user.perm_employee_view,
    perm_employee_create: user.perm_employee_create,
    perm_employee_edit: user.perm_employee_edit,
    perm_employee_delete: user.perm_employee_delete,
    perm_attendance_view: user.perm_attendance_view,
    perm_attendance_verify: user.perm_attendance_verify,
    perm_attendance_manual: user.perm_attendance_manual,
    perm_attendance_export: user.perm_attendance_export,
    // Leave
    perm_leave_view: user.perm_leave_view,
    perm_leave_view_all: user.perm_leave_view_all,
    perm_leave_approve: user.perm_leave_approve,
    // Overtime
    perm_overtime_view: user.perm_overtime_view,
    perm_overtime_view_all: user.perm_overtime_view_all,
    perm_overtime_approve: user.perm_overtime_approve,
    // Payroll
    perm_payroll_view: user.perm_payroll_view,
    perm_payroll_manage: user.perm_payroll_manage,
    // Role Management
    perm_role_view: user.perm_role_view,
    perm_role_manage: user.perm_role_manage,
  };

  return user;
};