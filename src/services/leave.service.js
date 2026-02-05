import pool from "../config/db.js";
import { calculateDays } from "../utils/dateUtils.js";

export const getAllLeaveTypes = async () => {
  const result = await pool.query("SELECT * FROM leave_types ORDER BY id ASC");
  return result.rows;
};

// 1. STANDARD EMPLOYEE REQUEST (Always Pending)
export const createLeaveRequest = async (data) => {
  const { userId, leaveTypeId, startDate, endDate, reason } = data;

  const daysRequested = calculateDays(startDate, endDate);

  if (daysRequested <= 0) {
    throw new Error("End date must be equal to or after start date.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const overlapCheck = await client.query(
      `SELECT * FROM leave_requests 
       WHERE user_id = $1 
       AND status NOT IN ('Rejected', 'Cancelled')
       AND (start_date <= $3 AND end_date >= $2)`,
      [userId, startDate, endDate]
    );

    if (overlapCheck.rows.length > 0) {
      throw new Error("You already have a leave request overlapping with these dates.");
    }

    const balanceCheck = await client.query(
      `SELECT * FROM employee_leave_balances 
       WHERE user_id = $1 AND leave_type_id = $2 AND year = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [userId, leaveTypeId]
    );

    const balanceRow = balanceCheck.rows[0];

    if (balanceRow) {
      const remainingDays = balanceRow.allocated_days - balanceRow.used_days;
      if (remainingDays < daysRequested) {
        throw new Error(
          `Insufficient credits. You only have ${remainingDays} days remaining.`
        );
      }
    }

    const query = `
      INSERT INTO leave_requests 
      (user_id, leave_type_id, start_date, end_date, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'Pending')
      RETURNING *
    `;

    const result = await client.query(query, [
      userId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    ]);

    await client.query("COMMIT");
    return result.rows[0];

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// 2. ADMIN CREATE REQUEST (For Specific Employee, Auto-Approved)
export const createAdminLeaveRequest = async (data) => {
  const { targetUserId, leaveTypeId, startDate, endDate, reason } = data;

  const daysRequested = calculateDays(startDate, endDate);

  if (daysRequested <= 0) {
    throw new Error("End date must be equal to or after start date.");
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const overlapCheck = await client.query(
      `SELECT * FROM leave_requests 
       WHERE user_id = $1 
       AND status NOT IN ('Rejected', 'Cancelled')
       AND (start_date <= $3 AND end_date >= $2)`,
      [targetUserId, startDate, endDate]
    );

    if (overlapCheck.rows.length > 0) {
      throw new Error("This employee already has a leave request overlapping with these dates.");
    }

    const balanceCheck = await client.query(
      `SELECT * FROM employee_leave_balances 
       WHERE user_id = $1 AND leave_type_id = $2 AND year = EXTRACT(YEAR FROM CURRENT_DATE)`,
      [targetUserId, leaveTypeId]
    );

    const balanceRow = balanceCheck.rows[0];

    if (balanceRow) {
      const remainingDays = balanceRow.allocated_days - balanceRow.used_days;
      if (remainingDays < daysRequested) {
        throw new Error(
          `Insufficient credits. Employee only has ${remainingDays} days remaining.`
        );
      }
    }

    const query = `
      INSERT INTO leave_requests 
      (user_id, leave_type_id, start_date, end_date, reason, status)
      VALUES ($1, $2, $3, $4, $5, 'Approved')
      RETURNING *
    `;

    const result = await client.query(query, [
      targetUserId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    ]);

    const leaveYear = new Date(startDate).getFullYear();
    await client.query(
      `UPDATE employee_leave_balances 
       SET used_days = used_days + $1 
       WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
      [daysRequested, targetUserId, leaveTypeId, leaveYear]
    );

    await client.query("COMMIT");
    return result.rows[0];

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getAllLeaves = async (userId, roleId) => {
  let query = `
    SELECT 
      lr.id,
      lr.user_id,
      lr.leave_type_id,
      lr.start_date,
      lr.end_date,
      lr.reason,
      lr.status,
      lr.created_at,
      lr.rejection_reason,
      u.fullname,
      u.email,
      (SELECT string_agg(substring(n from 1 for 1), '') 
       FROM regexp_split_to_table(u.fullname, '\s+') as n) as initials,
      lt.name AS leave_type,
      lt.color_code,
      lt.is_paid
    FROM leave_requests lr
    JOIN users u ON lr.user_id = u.id
    JOIN leave_types lt ON lr.leave_type_id = lt.id
  `;

  const params = [];

  if (roleId === 2) {
    query += ` WHERE lr.user_id = $1`;
    params.push(userId);
  }

  query += ` ORDER BY lr.created_at DESC`;

  const result = await pool.query(query, params);
  return result.rows;
};

export const getUserBalances = async (userId) => {
  const result = await pool.query(
    `SELECT 
       lb.allocated_days, 
       lb.used_days, 
       lt.name as leave_name 
     FROM employee_leave_balances lb
     JOIN leave_types lt ON lb.leave_type_id = lt.id
     WHERE lb.user_id = $1 AND lb.year = EXTRACT(YEAR FROM CURRENT_DATE)`,
    [userId]
  );
  return result.rows;
};

export const getLeaveById = async (id) => {
  const result = await pool.query(
    "SELECT * FROM leave_requests WHERE id = $1",
    [id]
  );
  return result.rows[0];
};

export const deleteLeave = async (id) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const res = await client.query(
      `SELECT * FROM leave_requests WHERE id = $1`,
      [id]
    );
    const request = res.rows[0];

    if (!request) {
      throw new Error("Request not found");
    }

    if (request.status === "Approved") {
      const days = calculateDays(request.start_date, request.end_date);
      const leaveYear = new Date(request.start_date).getFullYear();

      await client.query(
        `UPDATE employee_leave_balances 
         SET used_days = used_days - $1 
         WHERE user_id = $2 
           AND leave_type_id = $3 
           AND year = $4`,
        [days, request.user_id, request.leave_type_id, leaveYear]
      );
    }

    await client.query("DELETE FROM leave_requests WHERE id = $1", [id]);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const updateLeave = async (id, data) => {
  const { leaveTypeId, startDate, endDate, reason } = data;
  const result = await pool.query(
    `UPDATE leave_requests 
     SET leave_type_id = $1, start_date = $2, end_date = $3, reason = $4 
     WHERE id = $5 RETURNING *`,
    [leaveTypeId, startDate, endDate, reason, id]
  );
  return result.rows[0];
};

export const updateLeaveStatus = async (id, status, rejectionReason = null) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const res = await client.query(
      `SELECT * FROM leave_requests WHERE id = $1`,
      [id]
    );
    const request = res.rows[0];

    if (!request) throw new Error("Request not found");

    const days = calculateDays(request.start_date, request.end_date);
    const { user_id, leave_type_id, status: oldStatus } = request;
    const leaveYear = new Date(request.start_date).getFullYear();

    if (status === "Approved" && oldStatus !== "Approved") {
      await client.query(
        `UPDATE employee_leave_balances 
         SET used_days = used_days + $1 
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [days, user_id, leave_type_id, leaveYear]
      );
    }

    if (oldStatus === "Approved" && status !== "Approved") {
      await client.query(
        `UPDATE employee_leave_balances 
         SET used_days = used_days - $1 
         WHERE user_id = $2 AND leave_type_id = $3 AND year = $4`,
        [days, user_id, leave_type_id, leaveYear]
      );
    }

    const updateRes = await client.query(
      `UPDATE leave_requests 
       SET status = $1, rejection_reason = $3 
       WHERE id = $2 RETURNING *`,
      [status, id, rejectionReason]
    );

    await client.query("COMMIT");
    return updateRes.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const getLeaveStats = async (userId, roleId) => {
  const isAdmin = roleId === 1 || roleId === 3;
  const client = await pool.connect();
  
  try {
    const stats = {};

    // --- SHARED QUERY PARTS ---
    // If not admin, restrict all counts to the specific user_id
    const userFilter = isAdmin ? "" : `WHERE user_id = $1`;
    const params = isAdmin ? [] : [userId];

    // 1. TOTAL PENDING (Admin: All Pending | Staff: My Pending)
    const pendingQuery = isAdmin 
      ? `SELECT COUNT(*) FROM leave_requests WHERE status = 'Pending'`
      : `SELECT COUNT(*) FROM leave_requests WHERE user_id = $1 AND status = 'Pending'`;
    
    const pendingRes = await client.query(pendingQuery, params);
    stats.pendingCount = parseInt(pendingRes.rows[0].count);

    // 2. APPROVED REQUESTS (This Month)
    // Counts how many leave requests start in the current month
    const approvedQuery = isAdmin
      ? `SELECT COUNT(*) 
         FROM leave_requests 
         WHERE status = 'Approved' 
         AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)`
      : `SELECT COUNT(*) 
         FROM leave_requests 
         WHERE user_id = $1 
         AND status = 'Approved' 
         AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM CURRENT_DATE)
         AND EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM CURRENT_DATE)`;

    const approvedRes = await client.query(approvedQuery, params);
    stats.approvedCountMonth = parseInt(approvedRes.rows[0].count);

    // 3. REJECTED REQUESTS (This Month)
    const rejectedQuery = isAdmin
      ? `SELECT COUNT(*) FROM leave_requests 
         WHERE status = 'Rejected'
         AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM CURRENT_DATE)`
      : `SELECT COUNT(*) FROM leave_requests 
         WHERE user_id = $1 
         AND status = 'Rejected'
         AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM CURRENT_DATE)`;

    const rejectedRes = await client.query(rejectedQuery, params);
    stats.rejectedCount = parseInt(rejectedRes.rows[0].count);

    // 4. ROLE SPECIFIC STAT
    if (isAdmin) {
      // ADMIN: Count distinct employees on leave this month
      const activeRes = await client.query(
        `SELECT COUNT(DISTINCT user_id) FROM leave_requests 
         WHERE status = 'Approved'
         AND EXTRACT(MONTH FROM start_date) = EXTRACT(MONTH FROM CURRENT_DATE)`
      );
      stats.activeOnLeave = parseInt(activeRes.rows[0].count);
    } else {
      // EMPLOYEE: Their Total Approved Requests (All Time)
      const totalApprovedRes = await client.query(
        `SELECT COUNT(*) FROM leave_requests WHERE user_id = $1 AND status = 'Approved'`,
        [userId]
      );
      stats.totalApprovedCount = parseInt(totalApprovedRes.rows[0].count);
    }

    return stats;

  } finally {
    client.release();
  }
};