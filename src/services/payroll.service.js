import pool from "../config/db.js";

const PayrollService = {
  // --- 1. GET ALL PAY RUNS (For the History Table) ---
  getAllPayRuns: async () => {
    const result = await pool.query(
      `SELECT * FROM pay_runs ORDER BY pay_date DESC`
    );
    return result.rows;
  },

  // --- 2. GET RECORDS INSIDE A PAY RUN (For the Payslip View) ---
  getRecordsByRunId: async (payRunId) => {
    const result = await pool.query(
      `SELECT pr.*, u.fullname, u.position, u.branch, u.email 
       FROM payroll_records pr
       JOIN users u ON pr.user_id = u.id
       WHERE pr.pay_run_id = $1`,
      [payRunId]
    );
    return result.rows;
  },

  // --- 3. THE MAIN CALCULATION ENGINE ---
  createPayRun: async ({ start_date, end_date, pay_date, run_name }) => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN"); // Start Safety Transaction

      // A. Create the Pay Run Folder
      const runRes = await client.query(
        `INSERT INTO pay_runs (run_name, start_date, end_date, pay_date, status) 
         VALUES ($1, $2, $3, $4, 'Draft') RETURNING id`,
        [run_name, start_date, end_date, pay_date]
      );
      const payRunId = runRes.rows[0].id;

      // B. Get All Active Employees
      const usersRes = await client.query(
        `SELECT id, payrate, fullname FROM users WHERE "isActive" = true`
      );
      const users = usersRes.rows;

      // C. Loop through every employee
      for (const user of users) {
        // --- CALCULATION SETTINGS ---
        // Assumption: 'payrate' in DB is the MONTHLY salary.
        const monthlyRate = parseFloat(user.payrate || 0);
        const semiMonthlyRate = monthlyRate / 2;
        const dailyRate = monthlyRate / 22; // Approx 22 working days/month
        const hourlyRate = dailyRate / 8;

        // ---------------------------------------------------------
        // 1. ATTENDANCE (Days Present)
        // ---------------------------------------------------------
        const attendanceRes = await client.query(
          `SELECT COUNT(id) as days_present 
           FROM attendance 
           WHERE user_id = $1 
             AND date BETWEEN $2 AND $3 
             AND attendance_status = 'Present'`,
          [user.id, start_date, end_date]
        );
        const daysPresent = parseInt(attendanceRes.rows[0].days_present || 0);

        // LOGIC DECISION:
        // Are they paid Fixed (Semi-Monthly) or per Day?
        // Let's assume FIXED for now, but deduct absences if needed.
        // For simple start: Gross = SemiMonthlyRate.
        let basicPay = semiMonthlyRate;

        // Optional: If you want "No Work No Pay", uncomment this:
        // basicPay = daysPresent * dailyRate;

        // ---------------------------------------------------------
        // 2. OVERTIME CALCULATION
        // ---------------------------------------------------------
        const otRes = await client.query(
          `SELECT otr.total_hours, ott.rate 
           FROM overtime_requests otr
           JOIN overtime_types ott ON otr.ot_type_id = ott.id
           WHERE otr.user_id = $1 
             AND otr.status = 'Approved'
             AND otr.ot_date BETWEEN $2 AND $3`,
          [user.id, start_date, end_date]
        );

        let totalOvertimePay = 0;

        otRes.rows.forEach((ot) => {
          // Formula: HourlyRate * OT_Hours * OT_Rate (e.g. 1.25)
          const pay =
            hourlyRate * parseFloat(ot.total_hours) * parseFloat(ot.rate);
          totalOvertimePay += pay;
        });

        // ---------------------------------------------------------
        // 3. ALLOWANCES (Placeholder)
        // ---------------------------------------------------------
        // If you add an 'allowances' table later, query it here.
        let totalAllowances = 0;

        // Gross Pay before Deductions
        const grossPay = basicPay + totalOvertimePay + totalAllowances;

        // ---------------------------------------------------------
        // 4. DEDUCTIONS ENGINE (Loans, Tax, Etc.)
        // ---------------------------------------------------------
        let totalDeductions = 0;
        const deductionDetails = {};

        const plansRes = await client.query(
          `SELECT * FROM deduction_plans 
           WHERE user_id = $1 AND status = 'ACTIVE'`,
          [user.id]
        );

        for (const plan of plansRes.rows) {
          let amount = 0;

          // A. Calculate Amount
          if (plan.deduction_type === "FIXED") {
            amount = parseFloat(plan.amount);
          } else {
            // Percentage of BASIC (not Gross)
            amount = basicPay * (parseFloat(plan.amount) / 100);
          }

          // B. Check Loan Limits (If total_amount exists)
          if (plan.total_amount !== null) {
            const paid = parseFloat(plan.paid_amount || 0);
            const total = parseFloat(plan.total_amount);
            const balance = total - paid;

            if (balance < amount) amount = balance; // Don't over-deduct
            if (balance <= 0) amount = 0; // Already paid

            // UPDATE PLAN BALANCE
            if (amount > 0) {
              const newPaid = paid + amount;
              const newStatus = newPaid >= total ? "COMPLETED" : "ACTIVE";

              await client.query(
                `UPDATE deduction_plans 
                 SET paid_amount = $1, status = $2 
                 WHERE id = $3`,
                [newPaid, newStatus, plan.id]
              );
            }
          }

          if (amount > 0) {
            totalDeductions += amount;
            deductionDetails[plan.name] = amount;
          }
        }

        // ---------------------------------------------------------
        // 5. FINAL NET PAY & SAVE
        // ---------------------------------------------------------
        const netPay = grossPay - totalDeductions;

        await client.query(
          `INSERT INTO payroll_records 
           (pay_run_id, user_id, basic_salary, overtime_pay, allowances, deductions, net_pay, details, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Pending')`,
          [
            payRunId,
            user.id,
            basicPay,
            totalOvertimePay,
            totalAllowances,
            totalDeductions,
            netPay,
            JSON.stringify(deductionDetails),
          ]
        );
      }

      await client.query("COMMIT");
      return payRunId;
    } catch (error) {
      await client.query("ROLLBACK");
      console.error("Payroll Calc Error:", error);
      throw error;
    } finally {
      client.release();
    }
  },
};

export default PayrollService;
