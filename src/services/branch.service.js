import pool from "../config/db.js";

export const getAllBranches = async () => {
  const result = await pool.query(
    "SELECT id, name FROM branches ORDER BY name ASC"
  );
  return result.rows;
};
