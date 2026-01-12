import pool from "../config/db.js";

// Helper: Calculate hours between two time strings (HH:MM)
const calculateHours = (start, end) => {
  const [startH, startM] = start.split(":").map(Number);
  const [endH, endM] = end.split(":").map(Number);

  const startDate = new Date(0, 0, 0, startH, startM);
  const endDate = new Date(0, 0, 0, endH, endM);

  let diff = (endDate - startDate) / 1000 / 60 / 60; // in hours
  if (diff < 0) diff += 24; // Handle overnight OT if needed

  return diff.toFixed(2);
};

export const createOvertimeRequest = async (data) => {
  const { userId, date, startTime, endTime, reason } = data;

  const totalHours = calculateHours(startTime, endTime);

  if (totalHours <= 0) {
    throw new Error("End time must be after start time.");
  }

  const query = `
    INSERT INTO overtime_requests 
    (user_id, ot_date, start_time, end_time, total_hours, reason, status)
    VALUES ($1, $2, $3, $4, $5, $6, 'Pending')
    RETURNING *
  `;

  const result = await pool.query(query, [
    userId,
    date,
    startTime,
    endTime,
    totalHours,
    reason,
  ]);

  return result.rows[0];
};

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
      ot.created_at,
      
      -- Join User Info
      u.fullname,
      u.email,
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\s+') as n) as initials

    FROM overtime_requests ot
    JOIN users u ON ot.user_id = u.id
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

// --- HELPERS FOR EDIT/DELETE ---

export const getOvertimeById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM overtime_requests WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

export const deleteOvertime = async (id) => {
  await pool.query("DELETE FROM overtime_requests WHERE id = $1", [id]);
};

export const updateOvertime = async (id, data) => {
  const { date, startTime, endTime, reason } = data;
  const totalHours = calculateHours(startTime, endTime);

  const result = await pool.query(
    `UPDATE overtime_requests 
     SET ot_date = $1, start_time = $2, end_time = $3, total_hours = $4, reason = $5 
     WHERE id = $6 RETURNING *`,
    [date, startTime, endTime, totalHours, reason, id]
  );
  return result.rows[0];
};

export const updateOvertimeStatus = async (id, status) => {
  const result = await pool.query(
    `UPDATE overtime_requests SET status = $1 WHERE id = $2 RETURNING *`,
    [status, id]
  );
  return result.rows[0];
};
