import pool from "../config/db.js";

const DeductionService = {
  // 1. CREATE DEDUCTION (Fixed: Handles Global, Specific, and Downpayments)
  createDeduction: async (data) => {
    const {
      name,
      deduction_type,
      amount,
      is_global,
      selected_users, // Array of user IDs
      total_loan_amount,
      downpayment,
    } = data;

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // A. Create the MASTER PLAN
      const planRes = await client.query(
        `INSERT INTO deduction_plans (name, deduction_type, amount, is_global, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING *`,
        [name, deduction_type, amount, is_global || false],
      );
      const planId = planRes.rows[0].id;

      // B. Create SUBSCRIBERS
      if (is_global) {
        // GLOBAL: Assign to ALL active users
        await client.query(
          `INSERT INTO deduction_subscribers (deduction_plan_id, user_id, total_loan_amount, paid_loan_amount)
           SELECT $1, id, $2, $3 FROM users WHERE "isActive" = true
           ON CONFLICT DO NOTHING`,
          [planId, total_loan_amount || null, 0], // Global loans start at 0 paid
        );
      } else if (selected_users && selected_users.length > 0) {
        // SPECIFIC: Assign to selected users
        for (const userId of selected_users) {
          // 1. Create Subscription
          await client.query(
            `INSERT INTO deduction_subscribers 
             (deduction_plan_id, user_id, total_loan_amount, paid_loan_amount)
             VALUES ($1, $2, $3, 0)`,
            [planId, userId, total_loan_amount || null],
          );

          // 2. Handle Downpayment (if applicable)
          if (downpayment && downpayment > 0) {
            // Update the subscriber's paid amount
            await client.query(
              `UPDATE deduction_subscribers 
                SET paid_loan_amount = $1 
                WHERE deduction_plan_id = $2 AND user_id = $3`,
              [downpayment, planId, userId],
            );

            // Record in Ledger
            await client.query(
              `INSERT INTO deduction_ledger 
               (deduction_plan_id, user_id, amount_paid, pay_run_id)
               VALUES ($1, $2, $3, NULL)`, // NULL pay_run_id = Manual Cash Payment
              [planId, userId, downpayment],
            );
          }
        }
      }

      await client.query("COMMIT");
      return planRes.rows[0];
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },

  // 2. READ (GET ALL) - Enhanced to return FULL Subscriber Objects
  getAllPlans: async () => {
    const query = `
      SELECT 
        dp.*, 
        
        -- 1. Full Subscriber List (JSON Array)
        -- This allows the frontend to check "Is this assigned to me?"
        COALESCE(
          json_agg(
            json_build_object(
              'user_id', u.id, 
              'fullname', u.fullname, 
              'profile_picture', u.profile_picture,
              'position', u.position,
              'loan_total', ds.total_loan_amount,
              'loan_paid', ds.paid_loan_amount
            ) ORDER BY u.fullname ASC
          ) FILTER (WHERE u.id IS NOT NULL), 
          '[]'
        ) as subscribers,

        -- 2. Aggregates for the Card (Progress Bars)
        COALESCE(SUM(ds.total_loan_amount), 0) as total_loan_value,
        COALESCE(SUM(ds.paid_loan_amount), 0) as total_collected,
        COUNT(ds.id)::int as subscriber_count

      FROM deduction_plans dp
      LEFT JOIN deduction_subscribers ds ON dp.id = ds.deduction_plan_id
      LEFT JOIN users u ON ds.user_id = u.id
      GROUP BY dp.id
      ORDER BY dp.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // 3. TOGGLE STATUS (Pause/Resume)
  toggleStatus: async (id) => {
    const check = await pool.query(
      "SELECT status FROM deduction_plans WHERE id = $1",
      [id],
    );
    if (check.rows.length === 0) throw new Error("Plan not found");

    const currentStatus = check.rows[0].status;
    const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE";

    const result = await pool.query(
      "UPDATE deduction_plans SET status = $1 WHERE id = $2 RETURNING *",
      [newStatus, id],
    );
    return result.rows[0];
  },

  // 4. DELETE PLAN
  deletePlan: async (id) => {
    const query = "DELETE FROM deduction_plans WHERE id = $1 RETURNING id";
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) throw new Error("Plan not found");
    return result.rows[0];
  },

  // 5. UPDATE SUBSCRIBERS (Non-Destructive)
  // Ensures we don't accidentally delete loan history for existing users
  updateSubscribers: async (planId, userIds) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // A. Remove users NOT in the new list
      if (userIds.length > 0) {
        await client.query(
          `DELETE FROM deduction_subscribers 
           WHERE deduction_plan_id = $1 AND user_id NOT IN (${userIds.join(",")})`,
          [planId],
        );
      } else {
        // If list is empty, remove everyone
        await client.query(
          `DELETE FROM deduction_subscribers WHERE deduction_plan_id = $1`,
          [planId],
        );
      }

      // B. Add new users (Do nothing if they already exist to preserve loan history)
      for (const userId of userIds) {
        await client.query(
          `INSERT INTO deduction_subscribers (deduction_plan_id, user_id, paid_loan_amount)
           VALUES ($1, $2, 0)
           ON CONFLICT (deduction_plan_id, user_id) DO NOTHING`,
          [planId, userId],
        );
      }

      await client.query("COMMIT");
      return { success: true };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default DeductionService;
