import pool from "../config/db.js";

// 1. Fetch Roles
export const getAllRoles = async () => {
  const result = await pool.query(
    "SELECT * FROM roles ORDER BY id ASC"
  );
  return result.rows;
};

// 2. Update Role Permissions (UPDATED with Leave columns)
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
    // Leave (NEW)
    perm_leave_view_all,
    perm_leave_approve
  } = permissions;

  const result = await pool.query(
    `UPDATE roles 
     SET 
       perm_employee_view = $1, 
       perm_employee_create = $2, 
       perm_employee_edit = $3, 
       perm_employee_delete = $4,
       perm_attendance_view = $5,
       perm_attendance_verify = $6,
       perm_attendance_manual = $7,
       perm_attendance_export = $8,
       perm_leave_view_all = $9,
       perm_leave_approve = $10
     WHERE id = $11
     RETURNING *`,
    [
      perm_employee_view, 
      perm_employee_create, 
      perm_employee_edit, 
      perm_employee_delete,
      perm_attendance_view,
      perm_attendance_verify,
      perm_attendance_manual,
      perm_attendance_export,
      perm_leave_view_all, 
      perm_leave_approve,  
      id                 
    ]
  );

  return result.rows[0];
};