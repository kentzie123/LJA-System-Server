import pool from "../config/db.js";

export const getAllRoles = async () => {
  // Order by ID so they appear in a logical order (e.g., Admin first)
  const result = await pool.query(
    "SELECT id, role_name FROM roles ORDER BY id ASC"
  );
  return result.rows;
};
