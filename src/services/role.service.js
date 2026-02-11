import pool from "../config/db.js";

// 1. Fetch All Roles (Excluding Super Admin - ID 3)
export const getAllRoles = async () => {
  // Added WHERE id != 3 to hide Super Admin from the UI list
  const result = await pool.query(
    "SELECT * FROM roles WHERE id != 3 ORDER BY id ASC",
  );
  return result.rows;
};

// 1b. Fetch All Roles (For internal checks, includes Super Admin)
export const getAllRolesUnfiltered = async () => {
  const result = await pool.query("SELECT * FROM roles ORDER BY id ASC");
  return result.rows;
};

// 2. Create New Role
export const createRole = async (role_name) => {
  // Check duplicates
  const check = await pool.query("SELECT * FROM roles WHERE role_name = $1", [
    role_name,
  ]);
  if (check.rows.length > 0) {
    throw new Error("Role already exists");
  }

  // Insert
  const result = await pool.query(
    "INSERT INTO roles (role_name) VALUES ($1) RETURNING *",
    [role_name],
  );
  return result.rows[0];
};

// 3. Update Role Permissions (Full List)
export const updateRole = async (id, permissions) => {
  const {
    // Employee
    perm_employee_view,
    perm_employee_create,
    perm_employee_edit,
    perm_employee_delete,
    // Attendance
    perm_attendance_view,
    perm_attendance_verify,
    perm_attendance_manual,
    perm_attendance_export,
    // Leave
    perm_leave_view,
    perm_leave_view_all,
    perm_leave_approve,
    perm_leave_create,
    perm_leave_manage,
    // Overtime
    perm_overtime_view,
    perm_overtime_view_all,
    perm_overtime_approve,
    perm_overtime_create,
    perm_overtime_manage,
    // Deduction
    perm_deduction_view,
    perm_deduction_manage,
    // Allowance (NEW)
    perm_allowance_view,
    perm_allowance_manage,
    // Dashboard
    perm_dashboard_view,
    // Payroll
    perm_payroll_view,
    perm_payroll_view_all,
    perm_payroll_manage,
    perm_payroll_approve,
    // Roles
    perm_role_view,
    perm_role_manage,
  } = permissions;

  const result = await pool.query(
    `UPDATE roles 
      SET 
        perm_employee_view = $1, perm_employee_create = $2, perm_employee_edit = $3, perm_employee_delete = $4,
        perm_attendance_view = $5, perm_attendance_verify = $6, perm_attendance_manual = $7, perm_attendance_export = $8,
        perm_leave_view = $9, perm_leave_view_all = $10, perm_leave_approve = $11, 
        perm_leave_create = $12, perm_leave_manage = $13,
        perm_overtime_view = $14, perm_overtime_view_all = $15, perm_overtime_approve = $16, 
        perm_overtime_create = $17, perm_overtime_manage = $18,
        perm_deduction_view = $19, perm_deduction_manage = $20,
        perm_allowance_view = $21, perm_allowance_manage = $22,
        perm_dashboard_view = $23,
        perm_payroll_view = $24, perm_payroll_view_all = $25, 
        perm_payroll_manage = $26, perm_payroll_approve = $27,
        perm_role_view = $28, perm_role_manage = $29
      WHERE id = $30
      RETURNING *`,
    [
      // Employee (1-4)
      perm_employee_view,
      perm_employee_create,
      perm_employee_edit,
      perm_employee_delete,
      // Attendance (5-8)
      perm_attendance_view,
      perm_attendance_verify,
      perm_attendance_manual,
      perm_attendance_export,
      // Leave (9-13)
      perm_leave_view,
      perm_leave_view_all,
      perm_leave_approve,
      perm_leave_create,
      perm_leave_manage,
      // Overtime (14-18)
      perm_overtime_view,
      perm_overtime_view_all,
      perm_overtime_approve,
      perm_overtime_create,
      perm_overtime_manage,
      // Deduction (19-20)
      perm_deduction_view,
      perm_deduction_manage,
      // Allowance (21-22) - NEW
      perm_allowance_view,
      perm_allowance_manage,
      // Dashboard (23)
      perm_dashboard_view,
      // Payroll (24-27)
      perm_payroll_view,
      perm_payroll_view_all,
      perm_payroll_manage,
      perm_payroll_approve,
      // Roles (28-29)
      perm_role_view,
      perm_role_manage,
      // ID (30)
      id,
    ],
  );

  return result.rows[0];
};

// 4. Delete Role
export const deleteRole = async (id) => {
  // Safety Check 1: Is this role assigned to anyone?
  const userCheck = await pool.query(
    "SELECT count(*) FROM users WHERE role_id = $1",
    [id],
  );

  if (parseInt(userCheck.rows[0].count) > 0) {
    throw new Error(
      `Cannot delete this role. It is currently assigned to ${userCheck.rows[0].count} users.`,
    );
  }

  // Safety Check 2: Prevent deleting Admin (ID 1)
  if (parseInt(id) === 1) {
    throw new Error("System Admin role cannot be deleted.");
  }

  const result = await pool.query(
    "DELETE FROM roles WHERE id = $1 RETURNING *",
    [id],
  );

  return result.rows[0];
};