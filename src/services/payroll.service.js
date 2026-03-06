import pool from "../config/db.js";

const PayrollService = {
  // ==========================================
  // 1. CREATE PAY RUN (Generates as DRAFT)
  // ==========================================
  createPayRun: async ({ run_name, start_date, end_date, pay_date }) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // A. Create Pay Run Record as 'Draft'
      const runRes = await client.query(
        `INSERT INTO pay_runs (run_name, start_date, end_date, pay_date, status) 
         VALUES ($1, $2, $3, $4, 'Draft') RETURNING id`,
        [run_name, start_date, end_date, pay_date],
      );
      const payRunId = runRes.rows[0].id;

      // B. Get All Active Employees (EXCLUDING Admin & Super Admin)
      const usersRes = await client.query(
        `SELECT id, fullname, daily_rate FROM users 
         WHERE "isActive" = true 
         AND role_id NOT IN (1, 3)`,
      );

      // C. THE MAIN CALCULATION LOOP
      for (const user of usersRes.rows) {
        const hourlyRate = PayrollService.calculateHourlyRate(user.daily_rate);
        const attendance = await PayrollService.getAttendanceStats(client, user.id, start_date, end_date);
        const leaveStats = await PayrollService.getPaidLeaveStats(client, user.id, start_date, end_date);

        const totalPaidHours = attendance.total_worked_hours + leaveStats.hours;
        const basicPay = totalPaidHours * hourlyRate;
        const lateDeductionAmount = parseFloat((attendance.total_late_hours * hourlyRate).toFixed(2));

        const overtimeData = await PayrollService.calculateOvertime(client, user.id, start_date, end_date, hourlyRate);
        const totalOvertime = overtimeData.total_amount;

        const allowanceData = await PayrollService.calculateAllowances(client, user.id);
        const totalAllowances = allowanceData.total_amount;

        const deductionData = await PayrollService.calculateDeductions(client, user.id, basicPay);
        const totalDeductions = deductionData.total_amount;

        const netPay = basicPay + totalOvertime + totalAllowances - totalDeductions;

        const detailsPayload = {
          attendance_summary: {
            days_present: attendance.days_present,
            total_worked_hours: attendance.total_worked_hours,
            total_late_hours: attendance.total_late_hours,
            late_deduction_amount: lateDeductionAmount, 
            paid_leave_days: leaveStats.days,
            paid_leave_hours: leaveStats.hours,
            hourly_rate: hourlyRate, 
          },
          overtime_breakdown: overtimeData.breakdown,
          allowance_breakdown: allowanceData.breakdown,
          deduction_breakdown: deductionData.breakdown,
        };

        // Save the Payroll Record as 'Draft' (no ledger inserts yet)
        await client.query(
          `INSERT INTO payroll_records 
            (pay_run_id, user_id, basic_salary, overtime_pay, allowances, deductions, net_pay, details, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Draft')`,
          [
            payRunId, user.id, basicPay, totalOvertime,
            totalAllowances, totalDeductions, netPay, JSON.stringify(detailsPayload),
          ],
        );
      }

      await client.query("COMMIT");
      return { success: true, id: payRunId };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Payroll Error:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  // ==========================================
  // 2. APPROVE PAY RUN
  // ==========================================
  approvePayRun: async (payRunId) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const runCheck = await client.query(`SELECT status FROM pay_runs WHERE id = $1`, [payRunId]);
      if (runCheck.rows.length === 0) throw new Error("Pay Run not found");
      if (runCheck.rows[0].status === 'Approved') throw new Error("Pay Run is already approved");

      await client.query(`UPDATE pay_runs SET status = 'Approved' WHERE id = $1`, [payRunId]);
      await client.query(`UPDATE payroll_records SET status = 'Approved' WHERE pay_run_id = $1`, [payRunId]);

      const records = await client.query(`SELECT user_id, details FROM payroll_records WHERE pay_run_id = $1`, [payRunId]);

      // Extract deductions from JSON and push to ledger
      for (const record of records.rows) {
        const details = typeof record.details === 'string' ? JSON.parse(record.details) : record.details;
        const deductions = details.deduction_breakdown || [];
        
        for (const item of deductions) {
          if (item.plan_id && item.amount > 0) {
            await client.query(
              `INSERT INTO deduction_ledger (pay_run_id, deduction_plan_id, user_id, amount_paid)
               VALUES ($1, $2, $3, $4)`,
              [payRunId, item.plan_id, record.user_id, item.amount]
            );
          }
        }
      }

      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Approve Payroll Error:", error);
      throw error;
    } finally {
      client.release();
    }
  },

  // ==========================================
  // 3. HELPER FUNCTIONS
  // ==========================================

  checkManagePermission: async (userId) => {
    const result = await pool.query(`
      SELECT r.perm_payroll_manage 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.id = $1
    `, [userId]);
    return result.rows[0]?.perm_payroll_manage || false;
  },

  calculateHourlyRate: (dailyRateStr) => {
    const dailyRate = parseFloat(dailyRateStr || 0);
    if (dailyRate === 0) return 0;
    return dailyRate / 8;
  },

  getAttendanceStats: async (client, userId, startDate, endDate) => {
    const query = `
      SELECT 
        COALESCE(SUM(worked_hours), 0) as total_worked_hours,
        COUNT(id) as days_present,
        COALESCE(SUM(
          CASE 
            WHEN time_in >= '08:16:00'::time THEN 
              EXTRACT(EPOCH FROM (time_in - '08:00:00'::time)) / 3600
            ELSE 0 
          END
        ), 0) as total_late_hours
      FROM attendance
      WHERE user_id = $1
        AND date BETWEEN $2 AND $3
        AND status_in = 'Verified'
        AND status_out = 'Verified'
    `;
    const result = await client.query(query, [userId, startDate, endDate]);
    const row = result.rows[0];
    return {
      total_worked_hours: parseFloat(row.total_worked_hours || 0),
      days_present: parseInt(row.days_present || 0),
      total_late_hours: parseFloat(parseFloat(row.total_late_hours || 0).toFixed(2)),
    };
  },

  getPaidLeaveStats: async (client, userId, startDate, endDate) => {
    const query = `
      SELECT
        COALESCE(SUM(
          (LEAST(lr.end_date, $3::date) - GREATEST(lr.start_date, $2::date) + 1)
        ), 0) as total_leave_days
      FROM leave_requests lr
      JOIN leave_types lt ON lr.leave_type_id = lt.id
      WHERE lr.user_id = $1
        AND lr.status = 'Approved'
        AND lt.is_paid = true
        AND lr.start_date <= $3  
        AND lr.end_date >= $2
    `;
    const result = await client.query(query, [userId, startDate, endDate]);
    const days = parseInt(result.rows[0].total_leave_days || 0);
    return { days: days, hours: days * 8 };
  },

  calculateOvertime: async (client, userId, startDate, endDate, hourlyRate) => {
    const query = `
    SELECT ot.ot_date, ot.total_hours, ott.name as type_name, ott.rate as multiplier
    FROM overtime_requests ot
    JOIN overtime_types ott ON ot.ot_type_id = ott.id
    WHERE ot.user_id = $1 AND ot.ot_date BETWEEN $2 AND $3 AND ot.status = 'Approved'
  `;
    const result = await client.query(query, [userId, startDate, endDate]);
    let totalAmount = 0;
    const breakdown = [];

    for (const record of result.rows) {
      const hours = parseFloat(record.total_hours);
      const multiplier = parseFloat(record.multiplier);
      const cost = hourlyRate * multiplier * hours;
      totalAmount += cost;
      breakdown.push({
        date: record.ot_date, type: record.type_name,
        hours: hours, multiplier: multiplier, amount: parseFloat(cost.toFixed(2)),
      });
    }
    return { total_amount: totalAmount, breakdown: breakdown };
  },

  calculateAllowances: async (client, userId) => {
    let totalAllowance = 0;
    const breakdown = [];
    const query = `
      SELECT at.id as type_id, at.name, COALESCE(ea.custom_amount, at.amount) as final_amount
      FROM employee_allowances ea
      JOIN allowance_types at ON ea.allowance_type_id = at.id
      WHERE ea.user_id = $1 AND ea.is_active = true AND at.status = 'ACTIVE'
    `;
    const result = await client.query(query, [userId]);
    for (const row of result.rows) {
      const amount = parseFloat(row.final_amount);
      if (amount > 0) {
        totalAllowance += amount;
        breakdown.push({ id: row.type_id, name: row.name, amount: parseFloat(amount.toFixed(2)) });
      }
    }
    return { total_amount: totalAllowance, breakdown: breakdown };
  },

  calculateDeductions: async (client, userId, basicPay) => {
    let totalDeduction = 0;
    const breakdown = [];
    const query = `
      SELECT dp.id as plan_id, dp.name, dp.deduction_type, dp.amount as plan_amount, dp.is_global,
             ds.total_loan_amount, ds.paid_loan_amount
      FROM deduction_plans dp
      LEFT JOIN deduction_subscribers ds ON dp.id = ds.deduction_plan_id AND ds.user_id = $1
      WHERE dp.status = 'ACTIVE' AND (dp.is_global = true OR ds.user_id IS NOT NULL)
    `;
    const result = await client.query(query, [userId]);

    for (const plan of result.rows) {
      let deductionAmount = plan.deduction_type === "PERCENTAGE" 
        ? basicPay * (parseFloat(plan.plan_amount) / 100) 
        : parseFloat(plan.plan_amount);

      const totalLoan = parseFloat(plan.total_loan_amount || 0);
      if (totalLoan > 0) {
        const remainingBalance = totalLoan - parseFloat(plan.paid_loan_amount || 0);
        if (remainingBalance < deductionAmount) deductionAmount = remainingBalance;
        if (remainingBalance <= 0) deductionAmount = 0;
      }

      if (deductionAmount > 0) {
        deductionAmount = parseFloat(deductionAmount.toFixed(2));
        totalDeduction += deductionAmount;
        breakdown.push({
          plan_id: plan.plan_id, name: plan.name,
          amount: deductionAmount, is_global: plan.is_global,
        });
      }
    }
    return { total_amount: totalDeduction, breakdown: breakdown };
  },

  // ==========================================
  // 4. READ & DELETE OPERATIONS
  // ==========================================

  getPayRunDetails: async (id, canManage) => {
    const runQuery = `SELECT * FROM pay_runs WHERE id = $1`;
    const [runRes] = await Promise.all([pool.query(runQuery, [id])]);

    if (runRes.rows.length === 0) throw new Error("Pay Run not found");

    if (runRes.rows[0].status === 'Draft' && !canManage) {
      throw new Error("Unauthorized: This pay run is still a draft.");
    }

    const recordsQuery = `
      SELECT pr.*, 
             u.fullname, u.position, u.email, u.profile_picture,
             u.tin_number, u.sss_number, u.philhealth_number, u.pag_ibig_number, u.employee_id
      FROM payroll_records pr
      JOIN users u ON pr.user_id = u.id
      WHERE pr.pay_run_id = $1
      ORDER BY u.fullname ASC
    `;
    const totalsQuery = `
      SELECT 
        COALESCE(SUM(overtime_pay), 0) as total_overtime,
        COALESCE(SUM(allowances), 0) as total_allowances,
        COALESCE(SUM(deductions), 0) as total_deductions,
        COALESCE(SUM(net_pay), 0) as total_net_pay
      FROM payroll_records WHERE pay_run_id = $1
    `;

    const [recordsRes, totalsRes] = await Promise.all([
      pool.query(recordsQuery, [id]),
      pool.query(totalsQuery, [id]),
    ]);

    return {
      meta: runRes.rows[0],
      records: recordsRes.rows,
      totals: totalsRes.rows[0],
    };
  },

  getAllPayRuns: async (canManage) => {
    const statusFilter = canManage ? "" : "WHERE pr.status = 'Approved'";

    const result = await pool.query(`
      SELECT pr.*, 
      (SELECT COUNT(*) FROM payroll_records WHERE pay_run_id = pr.id) as employee_count,
      (SELECT COALESCE(SUM(net_pay), 0) FROM payroll_records WHERE pay_run_id = pr.id) as total_cost
      FROM pay_runs pr 
      ${statusFilter}
      ORDER BY pay_date DESC
    `);
    return result.rows;
  },

  getAllPayrollRecords: async () => {
    const query = `
      SELECT 
        pr.*, u.fullname, u.email, u.position,
        r.run_name, r.start_date as period_start, r.end_date as period_end, r.pay_date
      FROM payroll_records pr
      JOIN users u ON pr.user_id = u.id
      JOIN pay_runs r ON pr.pay_run_id = r.id
      WHERE pr.status = 'Approved'
      ORDER BY r.pay_date DESC, u.fullname ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  getUserPayrollRecords: async (userId) => {
    const query = `
      SELECT 
        pr.*, r.run_name, r.start_date as period_start, r.end_date as period_end, r.pay_date
      FROM payroll_records pr
      JOIN pay_runs r ON pr.pay_run_id = r.id
      WHERE pr.user_id = $1
        AND pr.status = 'Approved' 
      ORDER BY r.pay_date DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  },

  deletePayRun: async (id) => {
    const query = "DELETE FROM pay_runs WHERE id = $1 RETURNING id";
    const result = await pool.query(query, [id]);
    if (result.rowCount === 0) throw new Error("Pay Run not found");
    return result.rows[0];
  },
};

export default PayrollService;