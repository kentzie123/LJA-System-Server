import pool from "../config/db.js";


export const registerUser = async (userData) => {
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

export const loginUser = async (email, password) => {
  // 1. Find User
  const result = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);

  if (result.rows.length === 0) {
    throw new Error("Invalid Credentials");
  }

  const user = result.rows[0];

  // 2. Check Password
  if (password !== user.password) {
    throw new Error("Invalid Credentials");
  }

  return user;
};

export const getUserById = async (userId) => {
  // 1. Query database for the user ID (Also updated to fetch role_name if needed)
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
     WHERE u.id = $1`,
    [userId]
  );

  // 2. Check if user was found
  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  // 3. Return the user
  return result.rows[0];
};
