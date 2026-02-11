import pool from "../config/db.js";

const PayrollService = {
  // ==========================================
  // 1. CREATE PAY RUN (The Calculation Engine)
  // ==========================================
  createPayRun: async ({ run_name, start_date, end_date, pay_date }) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // A. Create Pay Run Record
      const runRes = await client.query(
        `INSERT INTO pay_runs (run_name, start_date, end_date, pay_date, status) 
         VALUES ($1, $2, $3, $4, 'Draft') RETURNING id`,
        [run_name, start_date, end_date, pay_date]
      );
      const payRunId = runRes.rows[0].id;

      // B. Get All Active Employees (EXCLUDING Admin & Super Admin)
      const usersRes = await client.query(
        `SELECT id, fullname, daily_rate FROM users 
         WHERE "isActive" = true 
         AND role_id NOT IN (1, 3)`
      );

      // C. THE MAIN CALCULATION LOOP
      for (const user of usersRes.rows) {
        // 1. Calculate Hourly Rate (Daily / 8)
        const hourlyRate = PayrollService.calculateHourlyRate(user.daily_rate);

        // 2. Calculate Attendance (Worked Hours)
        const attendance = await PayrollService.getAttendanceStats(
          client,
          user.id,
          start_date,
          end_date
        );

        // 3. Calculate Paid Leave
        const leaveStats = await PayrollService.getPaidLeaveStats(
          client,
          user.id,
          start_date,
          end_date
        );

        // 4. Calculate Basic Pay (Worked Hours + Paid Leave Hours)
        const totalPaidHours = attendance.total_worked_hours + leaveStats.hours;
        const basicPay = totalPaidHours * hourlyRate;

        // 5. Calculate Overtime (Approved Requests)
        const overtimeData = await PayrollService.calculateOvertime(
          client,
          user.id,
          start_date,
          end_date,
          hourlyRate
        );
        const totalOvertime = overtimeData.total_amount;

        // 6. CALCULATE ALLOWANCES (New Implementation)
        const allowanceData = await PayrollService.calculateAllowances(
          client,
          user.id
        );
        const totalAllowances = allowanceData.total_amount;

        // 7. CALCULATE DEDUCTIONS
        const deductionData = await PayrollService.calculateDeductions(
          client,
          user.id,
          basicPay
        );
        const totalDeductions = deductionData.total_amount;

        // 8. Calculate Net Pay
        // Formula: Basic + OT + Allowances - Deductions
        const netPay = basicPay + totalOvertime + totalAllowances - totalDeductions;

        // 9. Build the JSON Receipt (Details for Payslip)
        const detailsPayload = {
          attendance_summary: {
            days_present: attendance.days_present,
            total_worked_hours: attendance.total_worked_hours,
            total_late_hours: attendance.total_late_hours,
            paid_leave_days: leaveStats.days,
            paid_leave_hours: leaveStats.hours,
          },
          overtime_breakdown: overtimeData.breakdown,
          allowance_breakdown: allowanceData.breakdown, // Added Allowances here
          deduction_breakdown: deductionData.breakdown,
        };

        // 10. Save the Payroll Record
        await client.query(
          `INSERT INTO payroll_records 
            (pay_run_id, user_id, basic_salary, overtime_pay, allowances, deductions, net_pay, details, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')`,
          [
            payRunId,
            user.id,
            basicPay,
            totalOvertime,
            totalAllowances, // Save the actual total
            totalDeductions,
            netPay,
            JSON.stringify(detailsPayload),
          ]
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
  // 2. HELPER FUNCTIONS
  // ==========================================

  calculateHourlyRate: (dailyRateStr) => {
    const dailyRate = parseFloat(dailyRateStr || 0);
    if (dailyRate === 0) return 0;
    return dailyRate / 8;
  },

  // --- WORKER 1: Attendance Stats ---
  getAttendanceStats: async (client, userId, startDate, endDate) => {
    const query = `
      SELECT 
        -- 1. TOTAL WORKED HOURS
        COALESCE(SUM(worked_hours), 0) as total_worked_hours,

        COUNT(id) as days_present,

        -- 2. TOTAL LATE HOURS (For Reporting)
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
      total_late_hours: parseFloat(
        parseFloat(row.total_late_hours || 0).toFixed(2)
      ),
    };
  },

  // --- WORKER 2: Paid Leave Stats ---
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

    return {
      days: days,
      hours: days * 8,
    };
  },

  // --- WORKER 3: Overtime Calculation ---
  calculateOvertime: async (client, userId, startDate, endDate, hourlyRate) => {
    const query = `
      SELECT 
        ot.ot_date,
        ot.total_hours,
        ott.name as type_name,
        ott.rate as multiplier
      FROM overtime_requests ot
      JOIN overtime_types ott ON ot.ot_type_id = ott.id
      WHERE ot.user_id = $1
        AND ot.ot_date BETWEEN $2 AND $3
        AND ot.status = 'Approved'
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
        date: record.ot_date,
        type: record.type_name,
        hours: hours,
        amount: parseFloat(cost.toFixed(2)),
      });
    }

    return {
      total_amount: totalAmount,
      breakdown: breakdown,
    };
  },

  // --- WORKER 4: Allowances Calculation (NEW) ---
  calculateAllowances: async (client, userId) => {
    let totalAllowance = 0;
    const breakdown = [];

    // Query active allowances for this user
    // Priority: Use ea.custom_amount if set, otherwise use at.amount (default)
    const query = `
      SELECT 
        at.id as type_id,
        at.name,
        COALESCE(ea.custom_amount, at.amount) as final_amount
      FROM employee_allowances ea
      JOIN allowance_types at ON ea.allowance_type_id = at.id
      WHERE ea.user_id = $1
        AND ea.is_active = true
        AND at.status = 'ACTIVE'
    `;

    const result = await client.query(query, [userId]);

    for (const row of result.rows) {
      const amount = parseFloat(row.final_amount);

      if (amount > 0) {
        totalAllowance += amount;
        breakdown.push({
          id: row.type_id,
          name: row.name,
          amount: parseFloat(amount.toFixed(2)),
        });
      }
    }

    return {
      total_amount: totalAllowance,
      breakdown: breakdown,
    };
  },

  // --- WORKER 5: Deductions Calculation ---
  calculateDeductions: async (client, userId, basicPay) => {
    let totalDeduction = 0;
    const breakdown = [];

    const query = `
      SELECT 
        dp.id as plan_id, 
        dp.name, 
        dp.deduction_type, 
        dp.amount as plan_amount,
        dp.is_global,
        ds.total_loan_amount, 
        ds.paid_loan_amount
      FROM deduction_plans dp
      LEFT JOIN deduction_subscribers ds ON dp.id = ds.deduction_plan_id AND ds.user_id = $1
      WHERE dp.status = 'ACTIVE'
        AND (dp.is_global = true OR ds.user_id IS NOT NULL)
    `;

    const result = await client.query(query, [userId]);

    for (const plan of result.rows) {
      let deductionAmount = 0;
      const planValue = parseFloat(plan.plan_amount);

      // A. Calculate Base Deduction
      if (plan.deduction_type === "PERCENTAGE") {
        deductionAmount = basicPay * (planValue / 100);
      } else {
        deductionAmount = planValue;
      }

      // B. Loan Logic (if applicable)
      const totalLoan = parseFloat(plan.total_loan_amount || 0);

      if (totalLoan > 0) {
        const paidSoFar = parseFloat(plan.paid_loan_amount || 0);
        const remainingBalance = totalLoan - paidSoFar;

        // Cap deduction at remaining balance
        if (remainingBalance < deductionAmount) {
          deductionAmount = remainingBalance;
        }
        // If paid off, deduction is 0
        if (remainingBalance <= 0) deductionAmount = 0;
      }

      // C. Add to totals
      if (deductionAmount > 0) {
        deductionAmount = parseFloat(deductionAmount.toFixed(2));
        totalDeduction += deductionAmount;

        breakdown.push({
          plan_id: plan.plan_id,
          name: plan.name,
          amount: deductionAmount,
          is_global: plan.is_global,
        });
      }
    }

    return {
      total_amount: totalDeduction,
      breakdown: breakdown,
    };
  },

  // ==========================================
  // 3. READ & DELETE OPERATIONS
  // ==========================================

  getPayRunDetails: async (id) => {
    const runQuery = `SELECT * FROM pay_runs WHERE id = $1`;

    const recordsQuery = `
      SELECT pr.*, u.fullname, u.position, u.email, u.profile_picture
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

    const [runRes, recordsRes, totalsRes] = await Promise.all([
      pool.query(runQuery, [id]),
      pool.query(recordsQuery, [id]),
      pool.query(totalsQuery, [id]),
    ]);

    if (runRes.rows.length === 0) throw new Error("Pay Run not found");

    return {
      meta: runRes.rows[0],
      records: recordsRes.rows,
      totals: totalsRes.rows[0],
    };
  },

  getAllPayRuns: async () => {
    const result = await pool.query(`
      SELECT pr.*, 
      (SELECT COUNT(*) FROM payroll_records WHERE pay_run_id = pr.id) as employee_count,
      (SELECT COALESCE(SUM(net_pay), 0) FROM payroll_records WHERE pay_run_id = pr.id) as total_cost
      FROM pay_runs pr 
      ORDER BY pay_date DESC
    `);
    return result.rows;
  },

  getAllPayrollRecords: async () => {
    const query = `
      SELECT 
        pr.*,
        u.fullname,
        u.email,
        u.position,
        r.run_name,
        r.start_date as period_start,
        r.end_date as period_end,
        r.pay_date
      FROM payroll_records pr
      JOIN users u ON pr.user_id = u.id
      JOIN pay_runs r ON pr.pay_run_id = r.id
      ORDER BY r.pay_date DESC, u.fullname ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  getUserPayrollRecords: async (userId) => {
    const query = `
      SELECT 
        pr.*,
        r.run_name,
        r.start_date as period_start,
        r.end_date as period_end,
        r.pay_date
      FROM payroll_records pr
      JOIN pay_runs r ON pr.pay_run_id = r.id
      WHERE pr.user_id = $1
      ORDER BY r.pay_date DESC
    `;
    const result = await pool.query(query, [userId]);
    return result.rows;
  },

  deletePayRun: async (id) => {
    const query = "DELETE FROM pay_runs WHERE id = $1 RETURNING id";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new Error("Pay Run not found");
    }
    return result.rows[0];
  },

  // ==========================================
  // 4. FINALIZE PAY RUN (Commit Deductions)
  // ==========================================
  finalizePayRun: async (payRunId) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Get all payroll records for this run
      const recordsQuery = `
        SELECT user_id, details 
        FROM payroll_records 
        WHERE pay_run_id = $1
      `;
      const recordsRes = await client.query(recordsQuery, [payRunId]);

      // 2. Commit Deductions to Ledger
      for (const record of recordsRes.rows) {
        const userId = record.user_id;
        const details = record.details;
        const deductions = details.deduction_breakdown || [];

        for (const item of deductions) {
          if (item.plan_id) {
            await client.query(
              `INSERT INTO deduction_ledger 
                (pay_run_id, deduction_plan_id, user_id, amount_paid)
                VALUES ($1, $2, $3, $4)`,
              [payRunId, item.plan_id, userId, item.amount]
            );
          }
        }
      }

      // 3. Mark Run as Completed
      await client.query(
        "UPDATE pay_runs SET status = 'Completed' WHERE id = $1",
        [payRunId]
      );

      await client.query("COMMIT");
      return {
        success: true,
        message: "Pay run finalized and balances updated.",
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default PayrollService;