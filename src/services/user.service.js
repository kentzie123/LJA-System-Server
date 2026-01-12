import pool from "../config/db.js";

export const getAllUsers = async () => {
  const result = await pool.query(
    `SELECT 
      u.id, 
      u.fullname, 
      u.email, 
      u.role_id, 
      r.role_name, 
      u.payrate, 
      u.position, 
      u.branch, 
      u."isActive", 
      u.created_at 
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     ORDER BY u.id ASC`
  );

  return result.rows;
};

export const addUser = async (userData) => {
  const { fullname, email, password, role_id, payrate, position, branch } =
    userData;

  // 1. Check if user exists
  const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
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

export const deleteUser = async (userId) => {
  // 1. Delete the user based on ID
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [userId]
  );

  // 2. Check if any row was actually deleted
  if (result.rowCount === 0) {
    throw new Error("User not found or already deleted");
  }

  return result.rows[0];
};

export const editUser = async (userId, userData) => {
  const { fullname, email, password, role_id, payrate, position, branch } =
    userData;

  let query;
  let values;

  // CHECK: Did the user type a new password?
  if (password && password.trim() !== "") {
    // 1. UPDATE WITH PASSWORD
    query = `
      UPDATE users 
      SET fullname = $1, email = $2, password = $3, role_id = $4, payrate = $5, position = $6, branch = $7
      WHERE id = $8
      RETURNING id, fullname, email, role_id, payrate, position, branch
    `;
    values = [
      fullname,
      email,
      password,
      role_id,
      payrate,
      position,
      branch,
      userId,
    ];
  } else {
    // 2. UPDATE WITHOUT PASSWORD (Keep existing password)
    query = `
      UPDATE users 
      SET fullname = $1, email = $2, role_id = $3, payrate = $4, position = $5, branch = $6
      WHERE id = $7
      RETURNING id, fullname, email, role_id, payrate, position, branch
    `;
    values = [fullname, email, role_id, payrate, position, branch, userId];
  }

  const result = await pool.query(query, values);

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  return result.rows[0];
};
