import pool from "../config/db.js";

// ==========================================
// HELPER: THE PAYROLL MATH (Only affects worked_hours)
// ==========================================
// 1. START TIME: Caps calculation at 8:15 AM (ignores time before).
// 2. END TIME:   Caps calculation at 5:00 PM (17:00:00).
// 3. LUNCH:      Subtracts any overlap with 12:00 PM - 1:00 PM.
//
// NOTE: This math DOES NOT change the 'time_in' or 'time_out' columns.
//       It only calculates the 'worked_hours' number.
const WORKED_HOURS_SQL = `
  ROUND(CAST(
    GREATEST(0, 
      (
        -- A. Raw Duration (Effective End - Effective Start)
        EXTRACT(EPOCH FROM (
          LEAST($4::TIME, '17:00:00'::TIME) -         -- End Cap: 5:00 PM
          GREATEST($3::TIME, '08:15:00'::TIME)        -- Start Cap: 8:15 AM
        )) / 3600
      ) 
      - 
      (
        -- B. Lunch Deduction (Overlap with 12:00-13:00)
        GREATEST(0, 
          EXTRACT(EPOCH FROM (
            LEAST(LEAST($4::TIME, '17:00:00'::TIME), '13:00:00'::TIME) - 
            GREATEST(GREATEST($3::TIME, '08:15:00'::TIME), '12:00:00'::TIME)
          )) / 3600
        )
      )
    )
  AS NUMERIC), 2)
`;

// ==========================================
// 1. MANUAL ENTRY
// ==========================================
export const createManualEntry = async (entryData) => {
  const { userId, date, timeIn, timeOut, photoIn, photoOut } = entryData;

  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = $2",
    [userId, date]
  );

  if (check.rows.length > 0) {
    throw new Error(`Attendance record already exists for user on ${date}`);
  }

  const query = `
    INSERT INTO attendance (
      user_id, date, time_in, time_out, photo_in, photo_out, worked_hours
    ) 
    VALUES (
      $1, $2, 
      $3, -- SAVES EXACT TIME IN (e.g., 7:00 AM)
      $4, -- SAVES EXACT TIME OUT (e.g., 5:00 PM)
      $5, $6,
      ${WORKED_HOURS_SQL} -- MATH uses 8:15 AM
    ) 
    RETURNING *
  `;

  const result = await pool.query(query, [
    userId, date, timeIn, timeOut, photoIn || null, photoOut || null,
  ]);

  return result.rows[0];
};

// ==========================================
// 2. GET ALL ATTENDANCE
// ==========================================
export const getAllAttendance = async () => {
  const query = `
    SELECT 
      a.*, 
      u.fullname,
      u.email,
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\s+') as n) as initials
    FROM attendance a
    LEFT JOIN users u ON a.user_id = u.id
    ORDER BY a.date DESC, a.time_in DESC
  `;

  const result = await pool.query(query);
  return result.rows;
};

// ==========================================
// 3. DELETE ATTENDANCE
// ==========================================
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

// ==========================================
// 4. UPDATE ATTENDANCE
// ==========================================
export const updateAttendance = async (id, data) => {
  const { date, timeIn, timeOut } = data;
  const formattedTimeIn = timeIn || null;
  const formattedTimeOut = timeOut || null;

  // Swap Params for Update: $2 is Time In, $3 is Time Out
  const dynamicSQL = WORKED_HOURS_SQL
    .replace(/\$3/g, "$2") 
    .replace(/\$4/g, "$3");

  const query = `
    UPDATE attendance
    SET 
      date = $1,
      time_in = $2, -- SAVES EXACT INPUT
      time_out = $3,
      worked_hours = CASE 
        WHEN $2::TIME IS NOT NULL AND $3::TIME IS NOT NULL 
        THEN ${dynamicSQL}
        ELSE 0 
      END
    WHERE id = $4
    RETURNING *
  `;

  const result = await pool.query(query, [date, formattedTimeIn, formattedTimeOut, id]);

  if (result.rows.length === 0) {
    throw new Error("Attendance record not found.");
  }

  return result.rows[0];
};

// ==========================================
// 5. GET TODAY STATUS
// ==========================================
export const getTodayStatus = async (userId) => {
  const result = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE",
    [userId]
  );

  if (result.rows.length === 0) return { status: "idle" };
  const record = result.rows[0];
  if (record.time_in && !record.time_out) return { status: "clocked_in", record };
  return { status: "completed", record };
};

// ==========================================
// 6. CLOCK IN (LIVE)
// ==========================================
export const clockIn = async (userId, photoInBase64, locationData) => {
  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE",
    [userId]
  );

  if (check.rows.length > 0) {
    throw new Error("You have already clocked in for today.");
  }

  // We use "AT TIME ZONE 'Asia/Manila'" to fix the "8am recorded when 7am" bug
  // This forces the server to use Philippine time.
  const query = `
    INSERT INTO attendance (
      user_id, time_in, date, photo_in, location_in, status_in, attendance_status
    ) 
    VALUES (
      $1, 
      CURRENT_TIME AT TIME ZONE 'Asia/Manila', -- Force PH Time
      CURRENT_DATE AT TIME ZONE 'Asia/Manila', 
      $2, $3, 'Pending', 'Present'
    ) 
    RETURNING *
  `;

  const result = await pool.query(query, [userId, photoInBase64, locationData]);
  return result.rows[0];
};

// ==========================================
// 7. CLOCK OUT (LIVE)
// ==========================================
export const clockOut = async (userId, photoOutBase64, locationData) => {
  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE AND time_out IS NULL",
    [userId]
  );

  if (check.rows.length === 0) {
    throw new Error("No active Clock In record found for today.");
  }

  // Replace params with DB columns and PH system time
  const dynamicSQL = WORKED_HOURS_SQL
    .replace(/\$3::TIME/g, "time_in")
    .replace(/\$4::TIME/g, "(CURRENT_TIME AT TIME ZONE 'Asia/Manila')");

  const query = `
    UPDATE attendance
    SET 
      time_out = CURRENT_TIME AT TIME ZONE 'Asia/Manila', -- Force PH Time
      photo_out = $1,
      location_out = $2,
      status_out = 'Pending',
      worked_hours = ${dynamicSQL},
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $3 AND date = CURRENT_DATE AND time_out IS NULL
    RETURNING *
  `;

  const result = await pool.query(query, [photoOutBase64, locationData, userId]);
  return result.rows[0];
};

// ==========================================
// 8. VERIFY ATTENDANCE
// ==========================================
export const verifyAttendance = async (id, adminId, verificationData) => {
  const { type, status, notes } = verificationData;

  if (type !== "in" && type !== "out") {
    throw new Error("Invalid verification type. Must be 'in' or 'out'.");
  }

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

  const result = await pool.query(query, [status, adminId, notes, id]);

  if (result.rows.length === 0) {
    throw new Error("Attendance record not found.");
  }

  return result.rows[0];
};  