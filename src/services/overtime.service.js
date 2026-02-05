import pool from "../config/db.js";
import { calculateHours } from "../utils/timeUtils.js";

// 1. Get All Overtime Types (Dropdown)
export const getAllOvertimeTypes = async () => {
  const result = await pool.query(
    "SELECT * FROM overtime_types ORDER BY id ASC"
  );
  return result.rows;
};

// 2. Create Overtime Request (Standard Employee - Pending)
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

// 3. Create Admin Overtime Request (Admin Assign - Auto Approved)
export const createAdminOvertimeRequest = async (data) => {
  const { targetUserId, date, startTime, endTime, reason, otTypeId } = data;

  const totalHours = calculateHours(startTime, endTime);

  if (Number(totalHours) <= 0) {
    throw new Error("End time must be after start time.");
  }

  const query = `
    INSERT INTO overtime_requests 
    (user_id, ot_date, start_time, end_time, total_hours, reason, status, ot_type_id)
    VALUES ($1, $2, $3, $4, $5, $6, 'Approved', $7)
    RETURNING *
  `;

  const result = await pool.query(query, [
    targetUserId, // Use targetUserId here
    date,
    startTime,
    endTime,
    totalHours,
    reason,
    otTypeId,
  ]);

  return result.rows[0];
};

// 4. Get All Overtime Requests
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

// 5. Get Single Request by ID
export const getOvertimeById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM overtime_requests WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

// 6. Delete Request
export const deleteOvertime = async (id) => {
  await pool.query("DELETE FROM overtime_requests WHERE id = $1", [id]);
};

// 7. Update Request Details (Edit)
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

// 8. Update Status (Approve/Reject)
export const updateOvertimeStatus = async (id, status, rejectionReason) => {
  const result = await pool.query(
    `UPDATE overtime_requests 
     SET status = $1, rejection_reason = $2 
     WHERE id = $3 RETURNING *`,
    [status, rejectionReason || null, id]
  );
  return result.rows[0];
};


export const getOvertimeStats = async (userId, roleId) => {
  const isAdmin = roleId === 1 || roleId === 3;
  const client = await pool.connect();
  
  try {
    const stats = {};

    // --- SHARED QUERY PARTS ---
    // If not admin, restrict all counts to the specific user_id
    const userFilter = isAdmin ? "" : `WHERE user_id = $1`;
    const params = isAdmin ? [] : [userId];

    // 1. TOTAL PENDING (Admin: All Pending Reviews | Staff: My Pending Requests)
    // Note: We use WHERE or AND depending on if userFilter is empty or not
    const pendingQuery = isAdmin 
      ? `SELECT COUNT(*) FROM overtime_requests WHERE status = 'Pending'`
      : `SELECT COUNT(*) FROM overtime_requests WHERE user_id = $1 AND status = 'Pending'`;
    
    const pendingRes = await client.query(pendingQuery, params);
    stats.pendingCount = parseInt(pendingRes.rows[0].count);

    // 2. TOTAL HOURS APPROVED (This Month)
    const hoursQuery = isAdmin
      ? `SELECT COALESCE(SUM(total_hours), 0) as total 
         FROM overtime_requests 
         WHERE status = 'Approved' 
         AND EXTRACT(MONTH FROM ot_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM ot_date) = EXTRACT(YEAR FROM CURRENT_DATE)`
      : `SELECT COALESCE(SUM(total_hours), 0) as total 
         FROM overtime_requests 
         WHERE user_id = $1 
         AND status = 'Approved' 
         AND EXTRACT(MONTH FROM ot_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM ot_date) = EXTRACT(YEAR FROM CURRENT_DATE)`;

    const hoursRes = await client.query(hoursQuery, params);
    stats.approvedHoursMonth = parseFloat(hoursRes.rows[0].total).toFixed(1);

    // 3. REJECTED REQUESTS (This Month)
    const rejectedQuery = isAdmin
      ? `SELECT COUNT(*) FROM overtime_requests 
         WHERE status = 'Rejected'
         AND EXTRACT(MONTH FROM ot_date) = EXTRACT(MONTH FROM CURRENT_DATE)`
      : `SELECT COUNT(*) FROM overtime_requests 
         WHERE user_id = $1 
         AND status = 'Rejected'
         AND EXTRACT(MONTH FROM ot_date) = EXTRACT(MONTH FROM CURRENT_DATE)`;

    const rejectedRes = await client.query(rejectedQuery, params);
    stats.rejectedCount = parseInt(rejectedRes.rows[0].count);

    // 4. ROLE SPECIFIC STAT
    if (isAdmin) {
      // ADMIN: Count distinct employees who requested OT this month
      const activeRes = await client.query(
        `SELECT COUNT(DISTINCT user_id) FROM overtime_requests 
         WHERE EXTRACT(MONTH FROM ot_date) = EXTRACT(MONTH FROM CURRENT_DATE)`
      );
      stats.activeRequesters = parseInt(activeRes.rows[0].count);
    } else {
      // EMPLOYEE: Their Total Approved Requests (All Time)
      const approvedCountRes = await client.query(
        `SELECT COUNT(*) FROM overtime_requests WHERE user_id = $1 AND status = 'Approved'`,
        [userId]
      );
      stats.totalApprovedCount = parseInt(approvedCountRes.rows[0].count);
    }

    return stats;

  } finally {
    client.release();
  }
};