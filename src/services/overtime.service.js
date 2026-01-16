import pool from "../config/db.js";
import { calculateHours } from "../utils/timeUtils.js";

// 1. Get All Overtime Types (Dropdown)
export const getAllOvertimeTypes = async () => {
  const result = await pool.query(
    "SELECT * FROM overtime_types ORDER BY id ASC"
  );
  return result.rows;
};

// 2. Create Overtime Request
export const createOvertimeRequest = async (data) => {
  const { userId, date, startTime, endTime, reason, otTypeId } = data;

  const totalHours = calculateHours(startTime, endTime);

  if (Number(totalHours) <= 0) {
    throw new Error("End time must be after start time.");
  }

  const query = `
    INSERT INTO overtime_requests 
    (user_id, ot_date, start_time, end_time, total_hours, reason, status, ot_type_id)
    VALUES ($1, $2, $3, $4, $5, $6, 'Pending', $7)
    RETURNING *
  `;

  const result = await pool.query(query, [
    userId,
    date,
    startTime,
    endTime,
    totalHours,
    reason,
    otTypeId,
  ]);

  return result.rows[0];
};

// 3. Get All Overtime Requests
export const getAllOvertime = async (userId, roleId) => {
  let query = `
    SELECT 
      ot.id,
      ot.user_id,
      ot.ot_date,
      ot.start_time,
      ot.end_time,
      ot.total_hours,
      ot.reason,
      ot.status,
      ot.rejection_reason,
      ot.ot_type_id,
      ot.created_at,
      
      -- Join Type Info
      ott.name as ot_type, 
      ott.rate,

      -- Join User Info
      u.fullname,
      u.email,
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\s+') as n) as initials

    FROM overtime_requests ot
    JOIN users u ON ot.user_id = u.id
    LEFT JOIN overtime_types ott ON ot.ot_type_id = ott.id
  `;

  const params = [];

  // Filter: If not Admin (1 or 3), only show own requests
  if (roleId !== 1 && roleId !== 3) {
    query += ` WHERE ot.user_id = $1`;
    params.push(userId);
  }

  query += ` ORDER BY ot.created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

// 4. Get Single Request by ID
export const getOvertimeById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM overtime_requests WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

// 5. Delete Request
export const deleteOvertime = async (id) => {
  await pool.query("DELETE FROM overtime_requests WHERE id = $1", [id]);
};

// 6. Update Request Details (Edit)
export const updateOvertime = async (id, data) => {
  const { date, startTime, endTime, reason, otTypeId } = data;
  const totalHours = calculateHours(startTime, endTime);

  if (Number(totalHours) <= 0) {
    throw new Error("End time must be after start time.");
  }

  const result = await pool.query(
    `UPDATE overtime_requests 
     SET ot_date = $1, start_time = $2, end_time = $3, total_hours = $4, reason = $5, ot_type_id = $6
     WHERE id = $7 RETURNING *`,
    [date, startTime, endTime, totalHours, reason, otTypeId, id]
  );
  return result.rows[0];
};

// 7. Update Status (Approve/Reject)
export const updateOvertimeStatus = async (id, status, rejectionReason) => {
  const result = await pool.query(
    `UPDATE overtime_requests 
     SET status = $1, rejection_reason = $2 
     WHERE id = $3 RETURNING *`,
    [status, rejectionReason || null, id]
  );
  return result.rows[0];
};
