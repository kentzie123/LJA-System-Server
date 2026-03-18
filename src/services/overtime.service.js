import pool from "../config/db.js";

// ==========================================
// HELPER: CALCULATE HOURS
// ==========================================
const calculateHours = (start, end) => {
  const diff = new Date(end) - new Date(start);
  const hours = diff / (1000 * 60 * 60);
  return hours.toFixed(2);
};

// ==========================================
// 1. Get All Overtime Types
// ==========================================
export const getAllOvertimeTypes = async () => {
  const result = await pool.query(
    "SELECT * FROM overtime_types ORDER BY id ASC"
  );
  return result.rows;
};

// ==========================================
// 2. Create Overtime Request (Employee)
// ==========================================
export const createOvertimeRequest = async (data) => {
  const { userId, startAt, endAt, reason, otTypeId } = data;

  const totalHours = calculateHours(startAt, endAt);

  if (Number(totalHours) <= 0) {
    throw new Error("End datetime must be after start datetime.");
  }

  const query = `
    INSERT INTO overtime_requests
    (user_id, start_datetime, end_datetime, total_hours, reason, status, ot_type_id)
    VALUES ($1,$2,$3,$4,$5,'Pending',$6)
    RETURNING *
  `;

  const result = await pool.query(query, [
    userId,
    startAt,
    endAt,
    totalHours,
    reason,
    otTypeId,
  ]);

  return result.rows[0];
};

// ==========================================
// 3. Create Admin Overtime Request
// ==========================================
export const createAdminOvertimeRequest = async (data) => {
  const { targetUserId, startAt, endAt, reason, otTypeId } = data;

  const totalHours = calculateHours(startAt, endAt);

  if (Number(totalHours) <= 0) {
    throw new Error("End datetime must be after start datetime.");
  }

  const query = `
    INSERT INTO overtime_requests
    (user_id, start_datetime, end_datetime, total_hours, reason, status, ot_type_id)
    VALUES ($1,$2,$3,$4,$5,'Approved',$6)
    RETURNING *
  `;

  const result = await pool.query(query, [
    targetUserId,
    startAt,
    endAt,
    totalHours,
    reason,
    otTypeId,
  ]);

  return result.rows[0];
};

// ==========================================
// 4. Get All Overtime Requests
// ==========================================
export const getAllOvertime = async (userId, roleId, filters = {}) => {
  const { status, month, year, targetUserId, startDate, endDate } = filters;

  let query = `
    SELECT 
      ot.id,
      ot.user_id,
      ot.start_datetime,
      ot.end_datetime,
      ot.total_hours,
      ot.reason,
      ot.status,
      ot.rejection_reason,
      ot.ot_type_id,
      ot.created_at,
      
      ott.name as ot_type,
      ott.rate,

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
  let index = 1;

  if (roleId !== 1 && roleId !== 3) {
    query += ` AND ot.user_id = $${index}`;
    params.push(userId);
    index++;
  } else if (targetUserId) {
    query += ` AND ot.user_id = $${index}`;
    params.push(targetUserId);
    index++;
  }

  if (status && status !== "All") {
    query += ` AND ot.status = $${index}`;
    params.push(status);
    index++;
  }

  if (month && year) {
    query += ` AND EXTRACT(MONTH FROM ot.start_datetime) = $${index}`;
    params.push(month);
    index++;

    query += ` AND EXTRACT(YEAR FROM ot.start_datetime) = $${index}`;
    params.push(year);
    index++;
  }

  if (startDate && endDate) {
    query += ` AND ot.start_datetime >= $${index}`;
    params.push(startDate);
    index++;

    query += ` AND ot.end_datetime <= $${index}`;
    params.push(endDate);
    index++;
  }

  query += ` ORDER BY ot.created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

// ==========================================
// 5. Get Single Request
// ==========================================
export const getOvertimeById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM overtime_requests WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

// ==========================================
// 6. Delete Request
// ==========================================
export const deleteOvertime = async (id) => {
  await pool.query("DELETE FROM overtime_requests WHERE id = $1", [id]);
};

// ==========================================
// 7. Update Request
// ==========================================
export const updateOvertime = async (id, data) => {
  const { startAt, endAt, reason, otTypeId } = data;

  const totalHours = calculateHours(startAt, endAt);

  if (Number(totalHours) <= 0) {
    throw new Error("End datetime must be after start datetime.");
  }

  const result = await pool.query(
    `UPDATE overtime_requests
     SET start_datetime=$1,
         end_datetime=$2,
         total_hours=$3,
         reason=$4,
         ot_type_id=$5
     WHERE id=$6
     RETURNING *`,
    [startAt, endAt, totalHours, reason, otTypeId, id]
  );

  return result.rows[0];
};

// ==========================================
// 8. Update Status
// ==========================================
export const updateOvertimeStatus = async (id, status, rejectionReason) => {
  const result = await pool.query(
    `UPDATE overtime_requests
     SET status=$1, rejection_reason=$2
     WHERE id=$3
     RETURNING *`,
    [status, rejectionReason || null, id]
  );

  return result.rows[0];
};

// ==========================================
// 9. Overtime Stats
// ==========================================
export const getOvertimeStats = async (userId, roleId, filters = {}) => {
  const isAdmin = roleId === 1 || roleId === 3;
  const client = await pool.connect();
  const { month, year } = filters;

  try {
    const stats = {};

    const buildQuery = (selectPart, condition) => {
      let query = `SELECT ${selectPart} FROM overtime_requests WHERE ${condition}`;
      const params = [];
      let idx = 1;

      if (!isAdmin) {
        query += ` AND user_id = $${idx}`;
        params.push(userId);
        idx++;
      }

      if (month && year) {
        query += ` AND EXTRACT(MONTH FROM start_datetime) = $${idx}`;
        params.push(month);
        idx++;

        query += ` AND EXTRACT(YEAR FROM start_datetime) = $${idx}`;
        params.push(year);
        idx++;
      }

      return { query, params };
    };

    const pending = await client.query(
      ...Object.values(buildQuery("COUNT(*)", "status='Pending'"))
    );
    stats.pendingCount = parseInt(pending.rows[0].count);

    const hours = await client.query(
      ...Object.values(
        buildQuery("COALESCE(SUM(total_hours),0) as total", "status='Approved'")
      )
    );
    stats.approvedHoursMonth = parseFloat(hours.rows[0].total).toFixed(1);

    const rejected = await client.query(
      ...Object.values(buildQuery("COUNT(*)", "status='Rejected'"))
    );
    stats.rejectedCount = parseInt(rejected.rows[0].count);

    if (isAdmin) {
      const active = await client.query(
        "SELECT COUNT(DISTINCT user_id) FROM overtime_requests"
      );
      stats.activeRequesters = parseInt(active.rows[0].count);
    } else {
      const approved = await client.query(
        "SELECT COUNT(*) FROM overtime_requests WHERE user_id=$1 AND status='Approved'",
        [userId]
      );
      stats.totalApprovedCount = parseInt(approved.rows[0].count);
    }

    return stats;
  } finally {
    client.release();
  }
};