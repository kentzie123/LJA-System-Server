import pool from "../config/db.js";

// 1. Fetch All Users (UPDATED: Joins with Roles table)
export const getAllUsers = async () => {
  const result = await pool.query(`
    SELECT 
      u.id, 
      u.fullname, 
      u.email, 
      u.position, 
      u.role_id, 
      r.role_name,
      u.branch, 
      u."isActive", 
      u.created_at,
      u.profile_picture,
      u.daily_rate
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.role_id NOT IN (1, 3)  -- Excludes Admin (1) and Super Admin (3)
    ORDER BY u.id ASC
  `);
  return result.rows;
};

// 2. Add User (UPDATED: Includes daily_rate)
export const addUser = async (userData) => {
  const {
    fullname,
    email,
    password,
    role_id,
    payrate,
    position,
    branch,
    daily_rate,
  } = userData;

  // Check existence
  const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  if (userCheck.rows.length > 0) {
    throw new Error("User already exists!");
  }

  // Insert
  const result = await pool.query(
    `INSERT INTO users 
    (fullname, email, password, role_id, payrate, position, branch, daily_rate) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
    RETURNING id, fullname, email, role_id, position`,
    [fullname, email, password, role_id, payrate, position, branch, daily_rate],
  );

  return result.rows[0];
};

// 3. Edit User (UPDATED: Includes daily_rate)
export const editUser = async (id, userData) => {
  const { fullname, email, role_id, payrate, position, branch, daily_rate } =
    userData;

  const result = await pool.query(
    `WITH updated_user AS (
      UPDATE users 
      SET fullname = $1, 
          email = $2, 
          role_id = $3, 
          payrate = $4, 
          position = $5, 
          branch = $6, 
          daily_rate = $7
      WHERE id = $8 
      RETURNING *
   )
   SELECT 
      u.*, 
      r.role_name 
   FROM updated_user u
   LEFT JOIN roles r ON u.role_id = r.id`,
    [fullname, email, role_id, payrate, position, branch, daily_rate, id],
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  return result.rows[0];
};

// 4. Delete User
export const deleteUser = async (id) => {
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [id],
  );

  if (result.rows.length === 0) {
    throw new Error("User not found or already deleted");
  }

  return result.rows[0];
};

// 5. Update Profile Picture
export const updateProfilePicture = async (id, base64Image) => {
  const result = await pool.query(
    `UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING id, profile_picture`,
    [base64Image, id],
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }
  return result.rows[0];
};

// 6. Update Personal Profile (Self-Update)
export const updateUserProfile = async (id, userData) => {
  const { fullname, email } = userData;

  const result = await pool.query(
    `UPDATE users SET fullname = $1, email = $2 WHERE id = $3 RETURNING *`,
    [fullname, email, id],
  );

  if (result.rows.length === 0) {
    throw new Error("User not found");
  }
  return result.rows[0];
};
