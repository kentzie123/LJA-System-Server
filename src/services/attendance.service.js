import pool from "../config/db.js";
import { saveBase64Image } from "../utils/fileUtils.js"; // <-- NEW IMPORT

// ==========================================
// HELPER: THE PAYROLL MATH (Only affects worked_hours)
// ==========================================
// 1. GRACE PERIOD: If Time In is < 8:16 AM, we calculate from 8:00 AM.
//                  If Time In is >= 8:16 AM, we calculate from actual Time In.
// 2. END TIME:     Caps calculation at 5:00 PM (17:00:00).
// 3. LUNCH:        Subtracts any overlap with 12:00 PM - 1:00 PM.

const WORKED_HOURS_SQL = `
  ROUND(CAST(
    GREATEST(0, 
      (
        -- A. Raw Duration (Effective End - Effective Start)
        EXTRACT(EPOCH FROM (
          LEAST($4::TIME, '17:00:00'::TIME) -         -- End Cap: 5:00 PM
          
          -- FIX: LOGIC FOR START TIME
          -- If time_in is less than 08:16:00 (Grace Period), treat it as 08:00:00
          -- Otherwise, use the actual time_in (LATE)
          CASE 
            WHEN $3::TIME < '08:16:00'::TIME THEN '08:00:00'::TIME
            ELSE $3::TIME
          END
        )) / 3600
      ) 
      - 
      (
        -- B. Lunch Deduction (Overlap with 12:00-13:00)
        GREATEST(0, 
          EXTRACT(EPOCH FROM (
            LEAST(LEAST($4::TIME, '17:00:00'::TIME), '13:00:00'::TIME) - 
            GREATEST(
              -- Apply same Start Time logic for Lunch calculation
              CASE 
                WHEN $3::TIME < '08:16:00'::TIME THEN '08:00:00'::TIME
                ELSE $3::TIME
              END, 
              '12:00:00'::TIME
            )
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
  const { userId, date, timeIn, timeOut, photoIn, photoOut, workSummary } = entryData;

  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = $2",
    [userId, date]
  );

  if (check.rows.length > 0) {
    throw new Error(`Attendance record already exists for user on ${date}`);
  }

  // --- NEW: Save photos to disk if they exist ---
  const savedPhotoIn = await saveBase64Image(photoIn, userId, "in");
  const savedPhotoOut = await saveBase64Image(photoOut, userId, "out");

  const query = `
    INSERT INTO attendance (
      user_id, 
      date, 
      time_in, 
      time_out, 
      photo_in, 
      photo_out, 
      work_summary, 
      worked_hours
    ) 
    VALUES (
      $1, $2, 
      $3, 
      $4, 
      $5, 
      $6, 
      $7, -- New placeholder for work_summary
      ${WORKED_HOURS_SQL} 
    ) 
    RETURNING *
  `;

  const result = await pool.query(query, [
    userId, 
    date, 
    timeIn, 
    timeOut, 
    savedPhotoIn || null,  // Use the local URL
    savedPhotoOut || null, // Use the local URL
    workSummary || null 
  ]);

  return result.rows[0];
};

// ==========================================
// 2. GET ALL ATTENDANCE
// ==========================================
export const getAllAttendance = async (filters = {}) => {
  const { userId, startDate, endDate } = filters;

  let query = `
    SELECT 
      a.*, 
      u.fullname,
      u.email,
      u.profile_picture,
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\\s+') as n) as initials
    FROM attendance a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE 1=1
  `;

  const values = [];
  let paramIndex = 1;

  if (userId) {
    query += ` AND a.user_id = $${paramIndex}`;
    values.push(userId);
    paramIndex++;
  }

  if (startDate && endDate) {
    query += ` AND a.date BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
    values.push(startDate, endDate);
    paramIndex += 2;
  } else if (startDate) {
    query += ` AND a.date >= $${paramIndex}`;
    values.push(startDate);
    paramIndex++;
  } else if (endDate) {
    query += ` AND a.date <= $${paramIndex}`;
    values.push(endDate);
    paramIndex++;
  }

  query += ` ORDER BY a.date DESC, a.time_in DESC LIMIT 200`;

  const result = await pool.query(query, values);
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

  const dynamicSQL = WORKED_HOURS_SQL
    .replace(/\$3/g, "$2") 
    .replace(/\$4/g, "$3");

  const query = `
    UPDATE attendance
    SET 
      date = $1,
      time_in = $2,
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

  // Save photo to disk
  const photoUrl = await saveBase64Image(photoInBase64, userId, 'in');

  const query = `
    INSERT INTO attendance (
      user_id, time_in, date, photo_in, location_in, status_in, attendance_status
    ) 
    VALUES (
      $1, 
      CURRENT_TIME AT TIME ZONE 'Asia/Manila', 
      CURRENT_DATE AT TIME ZONE 'Asia/Manila', 
      $2, $3, 'Pending', 'Present'
    ) 
    RETURNING *
  `;

  const result = await pool.query(query, [userId, photoUrl, locationData]);
  return result.rows[0];
};

// ==========================================
// 7. CLOCK OUT (LIVE)
// ==========================================
export const clockOut = async (userId, photoOutBase64, locationData, workSummary) => {
  const check = await pool.query(
    "SELECT * FROM attendance WHERE user_id = $1 AND date = CURRENT_DATE AND time_out IS NULL",
    [userId]
  );

  if (check.rows.length === 0) {
    throw new Error("No active Clock In record found for today.");
  }

  // Save photo to disk
  const photoUrl = await saveBase64Image(photoOutBase64, userId, 'out');

  const query = `
    UPDATE attendance
    SET 
      time_out = (CURRENT_TIME AT TIME ZONE 'Asia/Manila')::TIME,
      photo_out = $1,
      location_out = $2,
      work_summary = $3,
      status_out = 'Pending',
      worked_hours = ROUND(CAST(
        GREATEST(0,
          (EXTRACT(EPOCH FROM (
            LEAST((CURRENT_TIME AT TIME ZONE 'Asia/Manila')::TIME, '17:00:00'::TIME) - 
            CASE 
              WHEN time_in < '08:16:00'::TIME THEN '08:00:00'::TIME 
              ELSE time_in 
            END
          )) / 3600)
          -
          GREATEST(0, 
            EXTRACT(EPOCH FROM (
              LEAST(LEAST((CURRENT_TIME AT TIME ZONE 'Asia/Manila')::TIME, '17:00:00'::TIME), '13:00:00'::TIME) - 
              GREATEST(
                CASE 
                  WHEN time_in < '08:16:00'::TIME THEN '08:00:00'::TIME 
                  ELSE time_in 
                END, 
                '12:00:00'::TIME
              )
            )) / 3600
          )
        ) AS NUMERIC), 2),
      updated_at = CURRENT_TIMESTAMP
    WHERE user_id = $4 AND date = CURRENT_DATE AND time_out IS NULL
    RETURNING *;
  `;

  const result = await pool.query(query, [photoUrl, locationData, workSummary, userId]);
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

export const verifyWorkday = async (id, adminId, status) => {
  const query = `
    UPDATE attendance
    SET 
      status_in = $1,
      status_out = $1,
      verified_by_in = $2,
      verified_by_out = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;

  const result = await pool.query(query, [status, adminId, id]);

  if (result.rows.length === 0) {
    throw new Error("Attendance record not found.");
  }

  return result.rows[0];
};

export const getAttendanceById = async (id) => {
  const query = `
    SELECT 
      a.*,
      u.fullname,
      u.email,
      u.profile_picture,
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\\s+') as n) as initials
    FROM attendance a
    JOIN users u ON a.user_id = u.id
    WHERE a.id = $1
  `;
  
  const { rows } = await pool.query(query, [id]);
  return rows[0];
};

// ==========================================
// 9. ADMIN OVERRIDE
// ==========================================
export const adminClockOverride = async (data) => {
  const { targetUserId, type, date, overrideTime, photo, workSummary } = data;

  const checkQuery = `SELECT * FROM attendance WHERE user_id = $1 AND date = $2`;
  const { rows } = await pool.query(checkQuery, [targetUserId, date]);
  let record = rows[0];

  // --- NEW: Save photo to disk ---
  const photoUrl = await saveBase64Image(photo, targetUserId, type);

  if (type === "in") {
    if (record) {
      const updateQuery = `
        UPDATE attendance 
        SET time_in = $1, photo_in = $2, status_in = 'Pending', updated_at = CURRENT_TIMESTAMP 
        WHERE id = $3 RETURNING *
      `;
      const result = await pool.query(updateQuery, [overrideTime, photoUrl, record.id]);
      record = result.rows[0];
    } else {
      const insertQuery = `
        INSERT INTO attendance (user_id, date, time_in, photo_in, status_in) 
        VALUES ($1, $2, $3, $4, 'Pending') RETURNING *
      `;
      const result = await pool.query(insertQuery, [targetUserId, date, overrideTime, photoUrl]);
      record = result.rows[0];
    }
  } 
  else if (type === "out") {
    if (!record) {
      const insertQuery = `
        INSERT INTO attendance (user_id, date, time_out, photo_out, status_out, work_summary) 
        VALUES ($1, $2, $3, $4, 'Pending', $5) RETURNING *
      `;
      const result = await pool.query(insertQuery, [targetUserId, date, overrideTime, photoUrl, workSummary]);
      record = result.rows[0];
    } else {
      const updateQuery = `
        UPDATE attendance 
        SET time_out = $1, photo_out = $2, status_out = 'Pending', work_summary = $3, updated_at = CURRENT_TIMESTAMP 
        WHERE id = $4 RETURNING *
      `;
      const result = await pool.query(updateQuery, [overrideTime, photoUrl, workSummary, record.id]);
      record = result.rows[0];
    }
  }

  // --- FIXED: CALCULATE WORKED HOURS USING SQL MATH ---
  if (record.time_in && record.time_out) {
    const dynamicSQL = WORKED_HOURS_SQL
      .replace(/\$3/g, "$1") 
      .replace(/\$4/g, "$2");

    const calcQuery = `
      UPDATE attendance 
      SET worked_hours = CASE 
        WHEN $1::TIME IS NOT NULL AND $2::TIME IS NOT NULL 
        THEN ${dynamicSQL} 
        ELSE 0 
      END
      WHERE id = $3 
      RETURNING *
    `;
    
    const calcResult = await pool.query(calcQuery, [record.time_in, record.time_out, record.id]);
    record = calcResult.rows[0]; 
  }

  return record;
};

// ==========================================
// 10. CALENDAR DATA
// ==========================================
export const getCalendarData = async (userId, year, month) => {
  const startDate = new Date(year, month, 1).toLocaleDateString('en-CA');
  const endDate = new Date(year, month + 1, 0).toLocaleDateString('en-CA');

  const attendancesQuery = `
    SELECT * FROM attendance 
    WHERE user_id = $1 AND date BETWEEN $2 AND $3
  `;
  const attendancesResult = await pool.query(attendancesQuery, [userId, startDate, endDate]);

  const leavesQuery = `
    SELECT lr.*, lt.name as type_name, lt.color_code 
    FROM leave_requests lr
    LEFT JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.user_id = $1 
    AND lr.status = 'Approved'
    AND (
      (lr.start_date BETWEEN $2 AND $3) OR 
      (lr.end_date BETWEEN $2 AND $3) OR
      (lr.start_date <= $2 AND lr.end_date >= $3)
    )
  `;
  const leavesResult = await pool.query(leavesQuery, [userId, startDate, endDate]);

  const overtimeQuery = `
    SELECT req.*, ot.name as type_name, ot.rate
    FROM overtime_requests req
    LEFT JOIN overtime_types ot ON req.ot_type_id = ot.id
    WHERE req.user_id = $1 
    AND req.status = 'Approved'
    AND req.ot_date BETWEEN $2 AND $3
  `;
  const overtimeResult = await pool.query(overtimeQuery, [userId, startDate, endDate]);

  return {
    attendances: attendancesResult.rows,
    leaves: leavesResult.rows,
    overtime: overtimeResult.rows
  };
};