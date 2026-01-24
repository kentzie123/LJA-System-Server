import pool from "../config/db.js";

const DeductionService = {
  createDeduction: async (data) => {
    // Add 'downpayment' to the destructured data
    const { name, deduction_type, amount, is_global, selected_users, total_loan_amount, downpayment } = data;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // 1. Create the MASTER PLAN
      const planRes = await client.query(
        `INSERT INTO deduction_plans (name, deduction_type, amount, is_global, status)
         VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING *`,
        [name, deduction_type, amount, is_global || false]
      );
      const planId = planRes.rows[0].id;

      // 2. Create SUBSCRIBERS (and handle Downpayment)
      if (!is_global && selected_users && selected_users.length > 0) {
        
        for (const userId of selected_users) {
          // A. Create the subscription record
          await client.query(
            `INSERT INTO deduction_subscribers 
             (deduction_plan_id, user_id, total_loan_amount, paid_loan_amount)
             VALUES ($1, $2, $3, 0)`,
            [planId, userId, total_loan_amount || null]
          );

          // B. IF DOWNPAYMENT EXISTS: Record it in the ledger immediately!
          // The database trigger will automatically update 'paid_loan_amount' above.
          if (downpayment && downpayment > 0) {
            await client.query(
              `INSERT INTO deduction_ledger 
               (deduction_plan_id, user_id, amount_paid, pay_run_id)
               VALUES ($1, $2, $3, NULL)`, // NULL pay_run_id means manual/cash payment
              [planId, userId, downpayment]
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

// 2. READ (GET ALL) - Enhanced to get Loan Progress & Names
  getAllPlans: async () => {
    const query = `
      SELECT 
        dp.*, 
        
        -- 1. Get the total Loan Goal (Limit) from subscribers
        -- We take the MAX because usually the limit is the same for the plan, 
        -- or strictly summed if you want total debt of all employees.
        (SELECT SUM(total_loan_amount) FROM deduction_subscribers WHERE deduction_plan_id = dp.id) as total_amount,

        -- 2. Count subscribers
        (SELECT COUNT(*) FROM deduction_subscribers WHERE deduction_plan_id = dp.id) as subscriber_count,
        
        -- 3. Get Names (for "Plan for [Name]" label)
        (SELECT json_agg(u.fullname) 
         FROM (
           SELECT users.fullname 
           FROM deduction_subscribers ds
           JOIN users ON ds.user_id = users.id
           WHERE ds.deduction_plan_id = dp.id
           LIMIT 3
         ) u
        ) as subscriber_names,

        -- 4. Calculate Total Collected (for Progress Bar)
        (SELECT COALESCE(SUM(paid_loan_amount), 0) 
         FROM deduction_subscribers 
         WHERE deduction_plan_id = dp.id) as total_collected

      FROM deduction_plans dp
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  },

  // ==========================================
  // 3. UPDATE (Edit Details or Status)
  // ==========================================
  updatePlan: async (id, data) => {
    const { name, amount, status } = data;

    // Dynamic update query (updates only what is sent)
    // Coalesce keeps the old value if the new one is null/undefined
    const query = `
      UPDATE deduction_plans
      SET 
        name = COALESCE($1, name),
        amount = COALESCE($2, amount),
        status = COALESCE($3, status)
      WHERE id = $4
      RETURNING *
    `;

    const result = await pool.query(query, [name, amount, status, id]);
    if (result.rows.length === 0) throw new Error("Plan not found");
    return result.rows[0];
  },

  // ==========================================
  // 4. DELETE
  // ==========================================
  deletePlan: async (id) => {
    // CASCADE in SQL will automatically remove subscribers and history
    const query = "DELETE FROM deduction_plans WHERE id = $1 RETURNING id";
    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) throw new Error("Plan not found");
    return result.rows[0];
  },

  // ==========================================
  // 5. MANAGE SUBSCRIBERS (Add/Remove Users)
  // ==========================================
  updateSubscribers: async (planId, userIds) => {
    // userIds should be an array of IDs: [1, 2, 5]
    // Strategy: Delete all existing subscribers for this plan, then re-insert the new list.
    // This handles both adding new people and removing old ones in one go.

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // A. Remove all current subscribers for this plan
      await client.query(
        "DELETE FROM deduction_subscribers WHERE deduction_plan_id = $1",
        [planId],
      );

      // B. Insert the new list
      if (userIds && userIds.length > 0) {
        for (const userId of userIds) {
          await client.query(
            `INSERT INTO deduction_subscribers (deduction_plan_id, user_id, paid_loan_amount)
             VALUES ($1, $2, 0)`,
            [planId, userId],
          );
        }
      }

      await client.query("COMMIT");
      return { success: true, count: userIds.length };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
};

export default DeductionService;
