import pool from "../config/db.js";

// 1. GET ALL USERS
export const getAllUsers = async () => {
  const result = await pool.query(
    `SELECT 
      u.id, 
      u.fullname, 
      u.email, 
      u.role_id, 
      r.role_name, 
      u.payrate, 
      u.daily_rate, 
      u.position, 
      u.branch, 
      u."isActive", 
      u.created_at,
      u.profile_picture
     FROM users u
     LEFT JOIN roles r ON u.role_id = r.id
     ORDER BY u.id ASC`,
  );

  return result.rows;
};

// 2. ADD USER
export const addUser = async (userData) => {
  // Added 'daily_rate' to destructuring
  const {
    fullname,
    email,
    password,
    role_id,
    payrate,
    daily_rate,
    position,
    branch,
  } = userData;

  // Check if user exists
  const userCheck = await pool.query("SELECT * FROM users WHERE email = $1", [
    email,
  ]);
  if (userCheck.rows.length > 0) {
    throw new Error("User already exists!");
  }

  // Insert User (Added daily_rate)
  const result = await pool.query(
    `INSERT INTO users 
      (fullname, email, password, role_id, payrate, daily_rate, position, branch) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
     RETURNING id, fullname, email, role_id`,
    [fullname, email, password, role_id, payrate, daily_rate, position, branch],
  );

  return result.rows[0];
};

// 3. DELETE USER
export const deleteUser = async (userId) => {
  const result = await pool.query(
    "DELETE FROM users WHERE id = $1 RETURNING id",
    [userId],
  );

  if (result.rowCount === 0) {
    throw new Error("User not found or already deleted");
  }

  return result.rows[0];
};

// 4. EDIT USER
export const editUser = async (userId, userData) => {
  // Added 'daily_rate'
  const {
    fullname,
    email,
    password,
    role_id,
    payrate,
    daily_rate,
    position,
    branch,
  } = userData;

  let query;
  let values;

  // CHECK: Did the user type a new password?
  if (password && password.trim() !== "") {
    // UPDATE WITH PASSWORD
    query = `
      UPDATE users 
      SET fullname = $1, email = $2, password = $3, role_id = $4, payrate = $5, daily_rate = $6, position = $7, branch = $8
      WHERE id = $9
      RETURNING id, fullname, email, role_id, payrate, daily_rate, position, branch
    `;
    values = [
      fullname,
      email,
      password,
      role_id,
      payrate,
      daily_rate,
      position,
      branch,
      userId,
    ];
  } else {
    // UPDATE WITHOUT PASSWORD
    query = `
      UPDATE users 
      SET fullname = $1, email = $2, role_id = $3, payrate = $4, daily_rate = $5, position = $6, branch = $7
      WHERE id = $8
      RETURNING id, fullname, email, role_id, payrate, daily_rate, position, branch
    `;
    values = [
      fullname,
      email,
      role_id,
      payrate,
      daily_rate,
      position,
      branch,
      userId,
    ];
  }

  const result = await pool.query(query, values);

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  return result.rows[0];
};

// 5. UPDATE PROFILE PICTURE
export const updateProfilePicture = async (userId, imageData) => {
  // 'imageData' will be the Base64 string
  const query = `
    UPDATE users 
    SET profile_picture = $1 
    WHERE id = $2 
    RETURNING id, profile_picture
  `;

  const result = await pool.query(query, [imageData, userId]);

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  return result.rows[0];
};

export const updateUserProfile = async (userId, userData) => {
  const { fullname, email, password } = userData;

  // 1. Start with the fields that are ALWAYS updated
  const fields = ["fullname = $1", "email = $2"];
  const values = [fullname, email];

  // 2. Conditionally add password only if it's provided (not empty)
  if (password && password.trim() !== "") {
    // Add to fields array. The $ index updates automatically (e.g., $3)
    fields.push(`password = $${values.length + 1}`);
    values.push(password);
  }

  // 3. Add the ID as the last parameter for the WHERE clause
  values.push(userId);
  const idParamIndex = values.length; 

  // 4. Construct the final query
  const query = `
    UPDATE users 
    SET ${fields.join(", ")}
    WHERE id = $${idParamIndex}
    RETURNING id, fullname, email
  `;

  const result = await pool.query(query, values);

  if (result.rowCount === 0) {
    throw new Error("User not found");
  }

  return result.rows[0];
};
