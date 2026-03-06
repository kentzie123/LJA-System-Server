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
export const getAllOvertime = async (userId, roleId, filters = {}) => {
  const { status, month, year, targetUserId, startDate, endDate } = filters;

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
      u.profile_picture,
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\\s+') as n) as initials

    FROM overtime_requests ot
    JOIN users u ON ot.user_id = u.id
    LEFT JOIN overtime_types ott ON ot.ot_type_id = ott.id
    WHERE 1=1 
  `;

  const params = [];
  let paramIndex = 1;

  // 1. Role / User Filter
  if (roleId !== 1 && roleId !== 3) {
    // Standard employee: only see their own
    query += ` AND ot.user_id = $${paramIndex}`;
    params.push(userId);
    paramIndex++;
  } else if (targetUserId) {
    // Admin checking a specific user
    query += ` AND ot.user_id = $${paramIndex}`;
    params.push(targetUserId);
    paramIndex++;
  }

  // 2. Status Filter
  if (status && status !== "All") {
    query += ` AND ot.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  // 3. Month & Year Filter (Overtime is usually a single day, so exact match is fine)
  if (month && year) {
    query += ` AND EXTRACT(MONTH FROM ot.ot_date) = $${paramIndex}`;
    params.push(month);
    paramIndex++;
    
    query += ` AND EXTRACT(YEAR FROM ot.ot_date) = $${paramIndex}`;
    params.push(year);
    paramIndex++;
  }

  // 4. Exact Date Range Filter (For DTR Export)
  if (startDate && endDate) {
    query += ` AND ot.ot_date >= $${paramIndex}::date`;
    params.push(startDate);
    paramIndex++;
    
    query += ` AND ot.ot_date <= $${paramIndex}::date`;
    params.push(endDate);
    paramIndex++;
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


export const getOvertimeStats = async (userId, roleId, filters = {}) => {
  const isAdmin = roleId === 1 || roleId === 3;
  const client = await pool.connect();
  const { month, year } = filters;

  try {
    const stats = {};

    // Dynamic Query Builder for Stats
    const buildQuery = (selectPart, baseCondition) => {
      let query = `SELECT ${selectPart} FROM overtime_requests WHERE ${baseCondition}`;
      const params = [];
      let idx = 1;

      if (!isAdmin) {
        query += ` AND user_id = $${idx}`;
        params.push(userId);
        idx++;
      }

      if (month && year) {
        query += ` AND EXTRACT(MONTH FROM ot_date) = $${idx}`;
        params.push(month);
        idx++;
        query += ` AND EXTRACT(YEAR FROM ot_date) = $${idx}`;
        params.push(year);
        idx++;
      }
      return { query, params };
    };

    // 1. PENDING (Selected Month)
    const q1 = buildQuery("COUNT(*)", "status = 'Pending'");
    const pendingRes = await client.query(q1.query, q1.params);
    stats.pendingCount = parseInt(pendingRes.rows[0].count);

    // 2. TOTAL HOURS APPROVED (Selected Month)
    const q2 = buildQuery("COALESCE(SUM(total_hours), 0) as total", "status = 'Approved'");
    const hoursRes = await client.query(q2.query, q2.params);
    stats.approvedHoursMonth = parseFloat(hoursRes.rows[0].total).toFixed(1);

    // 3. REJECTED REQUESTS (Selected Month)
    const q3 = buildQuery("COUNT(*)", "status = 'Rejected'");
    const rejectedRes = await client.query(q3.query, q3.params);
    stats.rejectedCount = parseInt(rejectedRes.rows[0].count);

    // 4. ROLE SPECIFIC STAT
    if (isAdmin) {
      // ADMIN: Active requesters this month
      let activeQuery = `SELECT COUNT(DISTINCT user_id) FROM overtime_requests WHERE 1=1`;
      let activeParams = [];
      if (month && year) {
        activeQuery += ` AND EXTRACT(MONTH FROM ot_date) = $1 AND EXTRACT(YEAR FROM ot_date) = $2`;
        activeParams = [month, year];
      }
      const activeRes = await client.query(activeQuery, activeParams);
      stats.activeRequesters = parseInt(activeRes.rows[0].count);
    } else {
      // EMPLOYEE: All-time approved count
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