import pool from "../config/db.js";

// 1. GET ALL ALLOWANCES (Returns full subscriber list now)
export const getAllAllowances = async () => {
  const query = `
    SELECT 
      at.*,
      -- Create a JSON list of subscribers
      COALESCE(
        json_agg(
          json_build_object(
            'user_id', u.id, 
            'fullname', u.fullname, 
            'profile_picture', u.profile_picture,
            'position', u.position
          ) ORDER BY u.fullname ASC
        ) FILTER (WHERE u.id IS NOT NULL), 
        '[]'
      ) as subscribers,
      -- Get the count
      COUNT(ea.id)::int as subscriber_count
    FROM allowance_types at
    LEFT JOIN employee_allowances ea ON at.id = ea.allowance_type_id
    LEFT JOIN users u ON ea.user_id = u.id
    GROUP BY at.id
    ORDER BY at.id ASC
  `;
  const { rows } = await pool.query(query);
  return rows;
};

// 2. CREATE NEW ALLOWANCE (Fixed to save Specific Users)
export const createAllowance = async (data) => {
  // EXTRACT 'userIds' FROM DATA
  const { name, amount, is_global, userIds } = data; 
  
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // A. Create the Allowance Type
    const insertType = `
      INSERT INTO allowance_types (name, amount, is_global)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const res = await client.query(insertType, [name, amount, is_global]);
    const allowance = res.rows[0];

    // B. Assign Employees
    if (is_global) {
      // Option 1: GLOBAL (Assign to everyone)
      const assignQuery = `
        INSERT INTO employee_allowances (user_id, allowance_type_id)
        SELECT id, $1 FROM users WHERE "isActive" = true
        ON CONFLICT (user_id, allowance_type_id) DO NOTHING
      `;
      await client.query(assignQuery, [allowance.id]);
      
    } else if (userIds && userIds.length > 0) {
      // Option 2: SPECIFIC (Assign to selected IDs)
      for (const userId of userIds) {
        await client.query(
          `INSERT INTO employee_allowances (user_id, allowance_type_id)
           VALUES ($1, $2)
           ON CONFLICT (user_id, allowance_type_id) DO NOTHING`,
          [userId, allowance.id]
        );
      }
    }

    await client.query("COMMIT");
    return allowance;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// 3. DELETE ALLOWANCE
export const deleteAllowance = async (id) => {
  await pool.query("DELETE FROM allowance_types WHERE id = $1", [id]);
};

// 4. TOGGLE STATUS
export const toggleAllowanceStatus = async (id) => {
  const check = await pool.query("SELECT status FROM allowance_types WHERE id = $1", [id]);
  if (check.rows.length === 0) throw new Error("Allowance not found");
  
  const currentStatus = check.rows[0].status;
  const newStatus = currentStatus === "ACTIVE" ? "PAUSED" : "ACTIVE"; 

  const result = await pool.query(
    "UPDATE allowance_types SET status = $1 WHERE id = $2 RETURNING *",
    [newStatus, id]
  );
  return result.rows[0];
};

// 5. UPDATE SUBSCRIBERS (For Manage Users modal)
export const updateSubscribers = async (allowanceId, userIds) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Remove users NOT in the new list
    if (userIds.length > 0) {
      await client.query(
        `DELETE FROM employee_allowances 
         WHERE allowance_type_id = $1 AND user_id NOT IN (${userIds.join(',')})`,
        [allowanceId]
      );
    } else {
      // If empty list, remove everyone
      await client.query(`DELETE FROM employee_allowances WHERE allowance_type_id = $1`, [allowanceId]);
    }

    // Add new users
    for (const userId of userIds) {
      await client.query(
        `INSERT INTO employee_allowances (user_id, allowance_type_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, allowance_type_id) DO NOTHING`,
        [userId, allowanceId]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};