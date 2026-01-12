import pool from "../config/db.js";

export const createManualEntry = async (entryData) => {
  const { userId, date, timeIn, timeOut, photoIn, photoOut } = entryData;

  // 1. Check if a record already exists for this date
  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = $2",
    [userId, date]
  );

  if (check.rows.length > 0) {
    throw new Error(`Attendance record already exists for user on ${date}`);
  }

  // 2. Insert and Calculate Hours
  // We explicitly cast the inputs ($3 and $4) to TIME to perform the math
  const query = `
    INSERT INTO attendance (
      user_id, 
      date, 
      time_in, 
      time_out, 
      photo_in, 
      photo_out, 
      worked_hours
    ) 
    VALUES (
      $1, $2, $3, $4, $5, $6,
      ROUND(CAST(EXTRACT(EPOCH FROM ($4::TIME - $3::TIME)) / 3600 AS NUMERIC), 2)
    ) 
    RETURNING *
  `;

  const result = await pool.query(query, [
    userId,
    date,
    timeIn,
    timeOut,
    photoIn || null, // Handle optional photos
    photoOut || null,
  ]);

  return result.rows[0];
};

export const getAllAttendance = async () => {
  const query = `
    SELECT 
      a.*, 
      u.fullname,
      u.email,
      -- Extract initials from fullname (e.g., "Alice Freeman" -> "AF")
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\s+') as n) as initials
    FROM attendance a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.date DESC, a.time_in DESC
  `;

  const result = await pool.query(query);
  return result.rows;
};

export const deleteAttendance = async (id) => {
  const result = await pool.query(
    "DELETE FROM attendance WHERE id = $1 RETURNING *",
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error("Attendance record not found.");
  }

  return result.rows[0];
};

export const updateAttendance = async (id, data) => {
  const { date, timeIn, timeOut } = data; // Removed status

  // Convert empty strings to null so PostgreSQL handles them correctly
  const formattedTimeIn = timeIn || null;
  const formattedTimeOut = timeOut || null;

  const query = `
    UPDATE attendance
    SET 
      date = $1,
      time_in = $2,
      time_out = $3,
      worked_hours = CASE 
        WHEN $2::TIME IS NOT NULL AND $3::TIME IS NOT NULL 
        THEN ROUND(CAST(EXTRACT(EPOCH FROM ($3::TIME - $2::TIME)) / 3600 AS NUMERIC), 2)
        ELSE 0 
      END
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [
    date,
    formattedTimeIn,
    formattedTimeOut,
    id,
  ]);

  if (result.rows.length === 0) {
    throw new Error("Attendance record not found.");
  }

  return result.rows[0];
};

export const getTodayStatus = async (userId) => {
  const result = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE",
    [userId]
  );

  if (result.rows.length === 0) return { status: "idle" };
  const record = result.rows[0];
  if (record.time_in && !record.time_out)
    return { status: "clocked_in", record };
  return { status: "completed", record };
};

export const clockIn = async (userId, photoInBase64, locationData) => {
  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE",
    [userId]
  );

  if (check.rows.length > 0) {
    throw new Error("You have already clocked in for today.");
  }

  // Insert Photo, Location, and set Status to Pending
  const query = `
    INSERT INTO attendance (
      user_id, 
      time_in, 
      date, 
      photo_in, 
      location_in, 
      status_in,      -- New
      attendance_status -- New
    ) 
    VALUES ($1, CURRENT_TIME, CURRENT_DATE, $2, $3, 'Pending', 'Present') 
    RETURNING *
  `;

  // locationData is expected to be { lat: 123, lng: 456, accuracy: 10 }
  const result = await pool.query(query, [userId, photoInBase64, locationData]);
  return result.rows[0];
};

export const clockOut = async (userId, photoOutBase64, locationData) => {
  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE AND time_out IS NULL",
    [userId]
  );

  if (check.rows.length === 0) {
    throw new Error("No active Clock In record found for today.");
  }

  // Update Photo, Location, and set Out Status to Pending
  const query = `
    UPDATE attendance
    SET 
      time_out = CURRENT_TIME,
      photo_out = $1,
      location_out = $2, -- New
      status_out = 'Pending', -- New
      worked_hours = ROUND(CAST(EXTRACT(EPOCH FROM (CURRENT_TIME - time_in)) / 3600 AS NUMERIC), 2),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $3 AND date = CURRENT_DATE AND time_out IS NULL
    RETURNING *
  `;

  const result = await pool.query(query, [
    photoOutBase64,
    locationData,
    userId,
  ]);
  return result.rows[0];
};

export const verifyAttendance = async (id, adminId, verificationData) => {
  const { type, status, notes } = verificationData;

  // Security Check: Ensure type is strictly 'in' or 'out'
  if (type !== "in" && type !== "out") {
    throw new Error("Invalid verification type. Must be 'in' or 'out'.");
  }

  // Determine which columns to update based on type
  const statusColumn = type === "in" ? "status_in" : "status_out";
  const verifierColumn = type === "in" ? "verified_by_in" : "verified_by_out";
  const notesColumn = type === "in" ? "notes_in" : "notes_out";

  const query = `
    UPDATE attendance
    SET 
      ${statusColumn} = $1,
      ${verifierColumn} = $2,
      ${notesColumn} = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [
    status, // $1: 'Verified' or 'Rejected'
    adminId, // $2: The Admin ID (from token)
    notes, // $3: Optional notes
    id, // $4: Record ID
  ]);

  if (result.rows.length === 0) {
    throw new Error("Attendance record not found.");
  }

  return result.rows[0];
};
