import pool from "../config/db.js";

const DashboardService = {
  // ==========================================
  // 1. ADMIN / MANAGER STATS
  // ==========================================
  getAdminStats: async () => {
    const client = await pool.connect();
    try {
      // A. Employee Counts
      const empQuery = `
        SELECT 
          COUNT(*) as total_employees,
          COUNT(CASE WHEN "isActive" = true THEN 1 END) as active_employees
        FROM users
        WHERE role_id NOT IN (1, 3) -- Exclude Admins if needed
      `;

      // B. Today's Attendance Snapshot
      // "On Time" means clocked in before 8:16 AM (based on your payroll logic)
      const attendanceQuery = `
        SELECT 
          COUNT(*) as present_today,
          COUNT(CASE WHEN time_in >= '08:16:00'::time THEN 1 END) as late_today
        FROM attendance 
        WHERE date = CURRENT_DATE
      `;

      // C. Employees on Leave Today
      const leaveQuery = `
        SELECT COUNT(*) as on_leave_today
        FROM leave_requests
        WHERE status = 'Approved' 
        AND CURRENT_DATE BETWEEN start_date AND end_date
      `;

      // D. Pending Approvals (The "To-Do" List)
      const pendingQuery = `
        SELECT
          (SELECT COUNT(*) FROM leave_requests WHERE status = 'Pending') as pending_leaves,
          (SELECT COUNT(*) FROM overtime_requests WHERE status = 'Pending') as pending_ot,
          (SELECT COUNT(*) FROM attendance WHERE status_in = 'Pending' OR status_out = 'Pending') as pending_attendance
      `;

      // E. Payroll Overview (Last Completed Run)
      const payrollQuery = `
        SELECT 
          pay_date, 
          (SELECT SUM(net_pay) FROM payroll_records WHERE pay_run_id = pr.id) as total_payout
        FROM pay_runs pr
        WHERE status = 'Completed'
        ORDER BY pay_date DESC
        LIMIT 1
      `;

      // Run all queries in parallel for speed
      const [empRes, attRes, leaveRes, pendingRes, payrollRes] =
        await Promise.all([
          client.query(empQuery),
          client.query(attendanceQuery),
          client.query(leaveQuery),
          client.query(pendingQuery),
          client.query(payrollQuery),
        ]);

      return {
        employees: empRes.rows[0],
        attendance: {
          ...attRes.rows[0],
          on_leave: leaveRes.rows[0].on_leave_today,
        },
        pending_actions: pendingRes.rows[0],
        last_payroll: payrollRes.rows[0] || null,
      };
    } finally {
      client.release();
    }
  },

  // ==========================================
  // 2. EMPLOYEE PERSONAL STATS
  // ==========================================
  getEmployeeStats: async (userId) => {
    const client = await pool.connect();
    try {
      // A. Leave Balances
      const leaveBalanceQuery = `
        SELECT 
          lt.name, 
          lt.color_code,
          elb.allocated_days, 
          elb.used_days,
          (elb.allocated_days - elb.used_days) as remaining
        FROM employee_leave_balances elb
        JOIN leave_types lt ON elb.leave_type_id = lt.id
        WHERE elb.user_id = $1 AND elb.year = EXTRACT(YEAR FROM CURRENT_DATE)
      `;

      // B. My Active Loans (Deductions)
      const loanQuery = `
        SELECT 
          dp.name, 
          dp.amount as amortization,
          ds.total_loan_amount,
          ds.paid_loan_amount,
          (ds.total_loan_amount - ds.paid_loan_amount) as balance
        FROM deduction_subscribers ds
        JOIN deduction_plans dp ON ds.deduction_plan_id = dp.id
        WHERE ds.user_id = $1 
        AND dp.status = 'ACTIVE'
        AND ds.total_loan_amount > 0 -- Only show actual loans, not recurring fees
        AND (ds.total_loan_amount - ds.paid_loan_amount) > 0 -- Only show active debt
      `;

      // C. My Attendance (Current Month)
      const myAttQuery = `
        SELECT 
          COUNT(*) as days_present,
          COUNT(CASE WHEN time_in >= '08:16:00'::time THEN 1 END) as late_count,
          SUM(worked_hours) as total_hours
        FROM attendance
        WHERE user_id = $1 
        AND date >= DATE_TRUNC('month', CURRENT_DATE)
      `;

      // D. Next Payday (Find next Draft run or guess based on policy)
      // For now, let's grab the latest "Draft" run
      const nextPayQuery = `
        SELECT pay_date FROM pay_runs 
        WHERE status = 'Draft' 
        AND pay_date >= CURRENT_DATE 
        ORDER BY pay_date ASC LIMIT 1
      `;

      const [leaveRes, loanRes, attRes, payRes] = await Promise.all([
        client.query(leaveBalanceQuery, [userId]),
        client.query(loanQuery, [userId]),
        client.query(myAttQuery, [userId]),
        client.query(nextPayQuery),
      ]);

      return {
        leave_balances: leaveRes.rows,
        active_loans: loanRes.rows,
        attendance_summary: attRes.rows[0],
        next_payday: payRes.rows[0]?.pay_date || "TBA",
      };
    } finally {
      client.release();
    }
  },
};

export default DashboardService;
