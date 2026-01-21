import pool from "../config/db.js";

const PayrollService = {

  // ==========================================
  // 1. CREATE PAY RUN (The Calculation Engine)
  // ==========================================
  // This replaces your simple insert with the full logic we planned:
  // 1. Create Run -> 2. Get Users -> 3. Calculate Pay -> 4. Save Records
  createPayRun: async ({ run_name, start_date, end_date, pay_date }) => {
    const client = await pool.connect(); // Use a client for transactions

    try {
      await client.query("BEGIN"); // Start safe transaction

      // --- A. Create the Pay Run Entry (Your original logic) ---
      const runRes = await client.query(
        `INSERT INTO pay_runs (run_name, start_date, end_date, pay_date, status) 
         VALUES ($1, $2, $3, $4, 'Draft') RETURNING id`,
        [run_name, start_date, end_date, pay_date]
      );
      const payRunId = runRes.rows[0].id;

      // --- B. Get Active Employees ---
      // We strictly need their ID and Daily Rate
      const usersRes = await client.query(
        `SELECT id, fullname, daily_rate FROM users WHERE "isActive" = true`
      );

      // --- C. THE MAIN CALCULATION LOOP ---
      for (const user of usersRes.rows) {
        
        // 1. Calculate Hourly Rate (Daily Rate / 8)
        const hourlyRate = PayrollService.calculateHourlyRate(user.daily_rate);

        // 2. Get Verified Attendance Stats (Helper function below)
        const attendance = await PayrollService.getAttendanceStats(
          client, 
          user.id, 
          start_date, 
          end_date
        );

        // 3. Calculate Base Pay
        // Formula: Total Verified Hours * Hourly Rate
        const basicPay = attendance.total_worked_hours * hourlyRate;

        // 4. Static Placeholders (For Overtime/Deductions later)
        const totalOvertime = 0.00;
        const totalDeductions = 0.00;
        const totalAllowances = 0.00;

        // 5. Calculate Net Pay
        const netPay = (basicPay + totalOvertime + totalAllowances) - totalDeductions;

        // 6. Create the "Receipt" (Details JSON)
        // This is crucial for the Payslip UI
        const detailsPayload = {
          attendance_summary: {
            days_present: attendance.days_present,
            total_worked_hours: attendance.total_worked_hours,
            total_late_hours: attendance.total_late_hours 
          },
          overtime_breakdown: [], 
          deduction_breakdown: []
        };

        // 7. Save the Payroll Record
        await client.query(
          `INSERT INTO payroll_records 
           (pay_run_id, user_id, basic_salary, overtime_pay, allowances, deductions, net_pay, details, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')`,
          [
            payRunId,
            user.id,
            basicPay,        
            totalOvertime,   
            totalAllowances, 
            totalDeductions, 
            netPay,          
            JSON.stringify(detailsPayload)
          ]
        );
      }

      await client.query("COMMIT"); // Save everything
      return { success: true, id: payRunId };

    } catch (error) {
      await client.query("ROLLBACK"); // Undo if anything fails
      console.error("Payroll Calculation Error:", error);
      throw error;
    } finally {
      client.release();
    }
  },


  
  // ==========================================
  // 2. HELPER FUNCTIONS (The Workers)
  // ==========================================

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
            WHEN time_in > '08:15:00'::time THEN 
              EXTRACT(EPOCH FROM (time_in - '08:15:00'::time)) / 3600
            ELSE 0 
          END
        ), 0) as total_late_hours
      FROM attendance
      WHERE user_id = $1
        AND date BETWEEN $2 AND $3
        AND status_in = 'Verified'   -- MUST BE VERIFIED
        AND status_out = 'Verified'  -- MUST BE VERIFIED
    `;

    const result = await client.query(query, [userId, startDate, endDate]);
    const row = result.rows[0];

    return {
      total_worked_hours: parseFloat(row.total_worked_hours),
      days_present: parseInt(row.days_present),
      total_late_hours: parseFloat(parseFloat(row.total_late_hours).toFixed(2))
    };
  },




  // ==========================================
  // 3. READ & DELETE (Existing Operations)
  // ==========================================

  getAllPayRuns: async () => {
    // I added a small upgrade here: It counts employees & total cost for the UI list
    const result = await pool.query(`
      SELECT pr.*, 
      (SELECT COUNT(*) FROM payroll_records WHERE pay_run_id = pr.id) as employee_count,
      (SELECT COALESCE(SUM(net_pay), 0) FROM payroll_records WHERE pay_run_id = pr.id) as total_cost
      FROM pay_runs pr 
      ORDER BY pay_date DESC
    `);
    return result.rows;
  },

  deletePayRun: async (id) => {
    const query = "DELETE FROM pay_runs WHERE id = $1 RETURNING id";
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new Error("Pay Run not found");
    }

    return result.rows[0];
  }
};

export default PayrollService;