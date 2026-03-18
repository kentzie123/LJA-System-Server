import pool from "../config/db.js";
import { saveBase64Image, deleteLocalFile } from "../utils/fileUtils.js";

// 1. Fetch All Users
export const getAllUsers = async () => {
  const result = await pool.query(`
    SELECT 
      u.*, 
      r.role_name,
      -- This subquery fetches all schedule rows and turns them into a JSON array
      (
        SELECT json_agg(
          json_build_object(
            'day_of_week', ws.day_of_week,
            'is_rest_day', ws.is_rest_day
          ) ORDER BY ws.day_of_week ASC
        )
        FROM work_schedules ws
        WHERE ws.user_id = u.id
      ) AS schedules
    FROM users u
    LEFT JOIN roles r ON u.role_id = r.id
    WHERE u.role_id != 3 
    ORDER BY u.id ASC
  `);
  return result.rows;
};

// 2. Add User
export const addUser = async (userData) => {
  const {
    fullname, email, password, role_id, payrate, position, branch, daily_rate,
    date_of_birth, place_of_birth, gender, civil_status, residential_address,
    contact_number, employee_id, employment_type, date_hired, sss_number,
    philhealth_number, pag_ibig_number, tin_number, bank_name, bank_account_number,
    emergency_contact_name, emergency_contact_number, emergency_relationship,
    pay_type, working_days_factor, schedules 
  } = userData;

  // --- SALARY AUTO-CORRECTION & SANITIZATION ---
  const safePayType = pay_type || 'Daily';
  let finalPayrate = payrate === "" ? null : payrate;
  let finalDailyRate = daily_rate === "" ? null : daily_rate;

  if (safePayType === 'Monthly') {
    // If Monthly, force the value into payrate (monthly salary)
    if (!finalPayrate && finalDailyRate) {
      finalPayrate = finalDailyRate;
      finalDailyRate = null;
    }
  } else {
    // If Daily, force the value into daily_rate
    if (!finalDailyRate && finalPayrate) {
      finalDailyRate = finalPayrate;
      finalPayrate = null;
    }
  }

  const safeDateOfBirth = date_of_birth === "" ? null : date_of_birth;
  const safeDateHired = date_hired === "" ? null : date_hired;

  // Determine schedules
  const defaultSchedules = [
    { day_of_week: 0, is_rest_day: true },
    { day_of_week: 1, is_rest_day: false },
    { day_of_week: 2, is_rest_day: false },
    { day_of_week: 3, is_rest_day: false },
    { day_of_week: 4, is_rest_day: false },
    { day_of_week: 5, is_rest_day: false },
    { day_of_week: 6, is_rest_day: true }
  ];
  const schedulesToInsert = schedules && schedules.length === 7 ? schedules : defaultSchedules;

  // Auto-calculate Factor
  let safeFactor = working_days_factor || 261;
  if (safePayType === 'Monthly') {
    const workingDaysCount = schedulesToInsert.filter(day => !day.is_rest_day).length;
    if (workingDaysCount <= 5) safeFactor = 261;
    else if (workingDaysCount === 6) safeFactor = 313;
    else if (workingDaysCount === 7) safeFactor = 365;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userCheck = await client.query("SELECT * FROM users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) throw new Error("User already exists!");

    const userRes = await client.query(
      `INSERT INTO users 
      (fullname, email, password, role_id, payrate, position, branch, daily_rate,
       date_of_birth, place_of_birth, gender, civil_status, residential_address,
       contact_number, employee_id, employment_type, date_hired, sss_number,
       philhealth_number, pag_ibig_number, tin_number, bank_name, bank_account_number,
       emergency_contact_name, emergency_contact_number, emergency_relationship,
       pay_type, working_days_factor) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28) 
      RETURNING id, fullname, email, role_id, position`,
      [
        fullname, email, password, role_id, finalPayrate, position, branch, finalDailyRate,
        safeDateOfBirth, place_of_birth, gender, civil_status, residential_address,
        contact_number, employee_id, employment_type, safeDateHired, sss_number,
        philhealth_number, pag_ibig_number, tin_number, bank_name, bank_account_number,
        emergency_contact_name, emergency_contact_number, emergency_relationship,
        safePayType, safeFactor
      ]
    );
    
    const newUserId = userRes.rows[0].id;

    await client.query(
      `INSERT INTO employee_leave_balances (user_id, leave_type_id, year, allocated_days, used_days)
       SELECT $1, id, EXTRACT(YEAR FROM CURRENT_DATE), 5, 0 FROM leave_types
       WHERE name IN ('Sick Leave', 'Vacation Leave')`, [newUserId]
    );

    for (const schedule of schedulesToInsert) {
      await client.query(
        `INSERT INTO work_schedules (user_id, day_of_week, is_rest_day) VALUES ($1, $2, $3)`,
        [newUserId, schedule.day_of_week, schedule.is_rest_day]
      );
    }

    await client.query("COMMIT");
    return userRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// 3. Edit User
export const editUser = async (id, userData) => {
  const { 
    fullname, email, password, role_id, payrate, position, branch, daily_rate,
    date_of_birth, place_of_birth, gender, civil_status, residential_address,
    contact_number, employee_id, employment_type, date_hired, sss_number,
    philhealth_number, pag_ibig_number, tin_number, bank_name, bank_account_number,
    emergency_contact_name, emergency_contact_number, emergency_relationship,
    pay_type, working_days_factor, schedules
  } = userData;

  // --- 1. SALARY SANITIZATION ---
  const safePayType = pay_type || 'Daily';
  let finalPayrate = payrate === "" ? null : payrate;
  let finalDailyRate = daily_rate === "" ? null : daily_rate;

  if (safePayType === 'Monthly') {
    if (!finalPayrate && finalDailyRate) {
      finalPayrate = finalDailyRate;
      finalDailyRate = null;
    }
  } else {
    if (!finalDailyRate && finalPayrate) {
      finalDailyRate = finalPayrate;
      finalPayrate = null;
    }
  }

  // --- 2. FACTOR AUTO-CALCULATION ---
  let safeFactor = null; // Default to null for Daily employees

  if (safePayType === 'Monthly') {
    // We prioritize the incoming schedules to determine the factor
    if (schedules && Array.isArray(schedules) && schedules.length === 7) {
      const workingDaysCount = schedules.filter(day => !day.is_rest_day).length;
      
      if (workingDaysCount <= 5) safeFactor = 261;
      else if (workingDaysCount === 6) safeFactor = 313;
      else if (workingDaysCount === 7) safeFactor = 365;
      else safeFactor = 261;
    } else {
      // Fallback if schedules weren't passed in the request
      safeFactor = working_days_factor || 261;
    }
  }

  const newPassword = password && password.trim() !== "" ? password : null;
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const userRes = await client.query(
      `WITH updated_user AS (
        UPDATE users 
        SET fullname = $1, email = $2, role_id = $3, payrate = $4, 
            position = $5, branch = $6, daily_rate = $7,
            date_of_birth = $8, place_of_birth = $9, gender = $10, civil_status = $11, 
            residential_address = $12, contact_number = $13, employee_id = $14, 
            employment_type = $15, date_hired = $16, sss_number = $17, 
            philhealth_number = $18, pag_ibig_number = $19, tin_number = $20, 
            bank_name = $21, bank_account_number = $22, emergency_contact_name = $23, 
            emergency_contact_number = $24, emergency_relationship = $25,
            password = COALESCE($26, password),
            pay_type = $27, working_days_factor = $28
        WHERE id = $29 
        RETURNING *
      )
      SELECT u.*, r.role_name FROM updated_user u
      LEFT JOIN roles r ON u.role_id = r.id`,
      [
        fullname, email, role_id, finalPayrate, position, branch, finalDailyRate,
        date_of_birth || null, place_of_birth, gender, civil_status, residential_address,
        contact_number, employee_id, employment_type, date_hired || null, sss_number,
        philhealth_number, pag_ibig_number, tin_number, bank_name, bank_account_number,
        emergency_contact_name, emergency_contact_number, emergency_relationship,
        newPassword, safePayType, safeFactor, id
      ]
    );

    if (userRes.rows.length === 0) throw new Error("User not found");

    // --- 3. UPSERT SCHEDULES ---
    if (schedules && Array.isArray(schedules)) {
      for (const schedule of schedules) {
        await client.query(
          `INSERT INTO work_schedules (user_id, day_of_week, is_rest_day)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, day_of_week) DO UPDATE SET is_rest_day = EXCLUDED.is_rest_day`,
          [id, schedule.day_of_week, schedule.is_rest_day]
        );
      }
    }

    await client.query("COMMIT");
    return userRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const deleteUser = async (id) => {
  const result = await pool.query("DELETE FROM users WHERE id = $1 RETURNING id", [id]);
  if (result.rows.length === 0) throw new Error("User not found or already deleted");
  return result.rows[0];
};

export const updateProfilePicture = async (id, base64Image) => {
  const userCheck = await pool.query("SELECT profile_picture FROM users WHERE id = $1", [id]);
  if (userCheck.rows.length === 0) throw new Error("User not found");
  const oldPhotoUrl = userCheck.rows[0].profile_picture;
  const newPhotoUrl = await saveBase64Image(base64Image, id, "profile");
  const result = await pool.query(`UPDATE users SET profile_picture = $1 WHERE id = $2 RETURNING id, profile_picture`, [newPhotoUrl, id]);
  if (oldPhotoUrl) await deleteLocalFile(oldPhotoUrl);
  return result.rows[0];
};

export const updateUserProfile = async (id, userData) => {
  const { fullname, email, password, date_of_birth, place_of_birth, gender, civil_status, residential_address, contact_number, emergency_contact_name, emergency_contact_number, emergency_relationship } = userData;
  const safeDateOfBirth = date_of_birth === "" ? null : date_of_birth;
  const newPassword = password && password.trim() !== "" ? password : null;
  const result = await pool.query(
    `UPDATE users SET fullname = $1, email = $2, date_of_birth = $3, place_of_birth = $4, gender = $5, civil_status = $6, residential_address = $7, contact_number = $8, emergency_contact_name = $9, emergency_contact_number = $10, emergency_relationship = $11, password = COALESCE($12, password) WHERE id = $13 RETURNING *`,
    [fullname, email, safeDateOfBirth, place_of_birth, gender, civil_status, residential_address, contact_number, emergency_contact_name, emergency_contact_number, emergency_relationship, newPassword, id]
  );
  if (result.rows.length === 0) throw new Error("User not found");
  return result.rows[0];
};

export const getUserByEmployeeId = async (employeeId) => {
  const result = await pool.query(`
    SELECT u.id, u.fullname, u.email, u.position, u.role_id, r.role_name, u.branch, u."isActive", u.created_at, COALESCE(u.profile_picture, '/images/default_profile.jpg') AS profile_picture, u.daily_rate, u.payrate, u.pay_type, u.working_days_factor, u.date_of_birth, u.place_of_birth, u.gender, u.civil_status, u.residential_address, u.contact_number, u.employee_id, u.employment_type, u.date_hired, u.sss_number, u.philhealth_number, u.pag_ibig_number, u.tin_number, u.bank_name, u.bank_account_number, u.emergency_contact_name, u.emergency_contact_number, u.emergency_relationship
    FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.employee_id = $1
  `, [employeeId]); 
  if (result.rows.length === 0) throw new Error("User not found");
  const user = result.rows[0];
  const scheduleResult = await pool.query(`SELECT day_of_week, is_rest_day FROM work_schedules WHERE user_id = $1 ORDER BY day_of_week ASC`, [user.id]);
  user.schedules = scheduleResult.rows;
  return user;
};