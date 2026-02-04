import pool from "../config/db.js";

// 1. Fetch All Roles
export const getAllRoles = async () => {
  const result = await pool.query("SELECT * FROM roles ORDER BY id ASC");
  return result.rows;
};

// 2. Create New Role
export const createRole = async (role_name) => {
  // Check duplicates
  const check = await pool.query("SELECT * FROM roles WHERE role_name = $1", [role_name]);
  if (check.rows.length > 0) {
    throw new Error("Role already exists");
  }

  // Insert
  const result = await pool.query(
    "INSERT INTO roles (role_name) VALUES ($1) RETURNING *",
    [role_name]
  );
  return result.rows[0];
};

// 3. Update Role Permissions (Full List)
export const updateRole = async (id, permissions) => {
  const {
    // Employee
    perm_employee_view, perm_employee_create, perm_employee_edit, perm_employee_delete,
    // Attendance
    perm_attendance_view, perm_attendance_verify, perm_attendance_manual, perm_attendance_export,
    // Leave
    perm_leave_view, perm_leave_view_all, perm_leave_approve,
    // Overtime
    perm_overtime_view, perm_overtime_view_all, perm_overtime_approve,
    // Payroll
    perm_payroll_view, perm_payroll_manage,
    // Roles (NEW)
    perm_role_view, perm_role_manage
  } = permissions;

  const result = await pool.query(
    `UPDATE roles 
     SET 
       perm_employee_view = $1, perm_employee_create = $2, perm_employee_edit = $3, perm_employee_delete = $4,
       perm_attendance_view = $5, perm_attendance_verify = $6, perm_attendance_manual = $7, perm_attendance_export = $8,
       perm_leave_view = $9, perm_leave_view_all = $10, perm_leave_approve = $11,
       perm_overtime_view = $12, perm_overtime_view_all = $13, perm_overtime_approve = $14,
       perm_payroll_view = $15, perm_payroll_manage = $16,
       perm_role_view = $17, perm_role_manage = $18
     WHERE id = $19
     RETURNING *`,
    [
      perm_employee_view, perm_employee_create, perm_employee_edit, perm_employee_delete,
      perm_attendance_view, perm_attendance_verify, perm_attendance_manual, perm_attendance_export,
      perm_leave_view, perm_leave_view_all, perm_leave_approve,
      perm_overtime_view, perm_overtime_view_all, perm_overtime_approve,
      perm_payroll_view, perm_payroll_manage,
      perm_role_view, perm_role_manage, // $17, $18
      id // $19
    ]
  );

  return result.rows[0];
};

// 4. Delete Role
export const deleteRole = async (id) => {
  // Safety Check 1: Is this role assigned to anyone?
  const userCheck = await pool.query(
    "SELECT count(*) FROM users WHERE role_id = $1", 
    [id]
  );
  
  if (parseInt(userCheck.rows[0].count) > 0) {
    throw new Error(`Cannot delete this role. It is currently assigned to ${userCheck.rows[0].count} users.`);
  }

  // Safety Check 2: Prevent deleting Admin (ID 1)
  if (parseInt(id) === 1) {
     throw new Error("System Admin role cannot be deleted.");
  }

  const result = await pool.query(
    "DELETE FROM roles WHERE id = $1 RETURNING *",
    [id]
  );

  return result.rows[0];
};