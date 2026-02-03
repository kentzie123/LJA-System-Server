import jwt from "jsonwebtoken";
import pool from "../config/db.js";

// 1. Verify Token (Keep this as is)
export const verifyToken = (req, res, next) => {
  const token = req.cookies.lja_hris_token;

  if (!token) {
    return res.status(401).json({ error: "Access denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains userId and role_id
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
};

// 2. NEW: Check Specific Permission (The Upgrade)
// Usage: checkPermission('perm_employee_create')
export const checkPermission = (permissionColumn) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.userId; // Gotten from verifyToken

      // Query the DB to check the dynamic permission for this user's role
      // We query the DB so changes in the "Roles Page" apply IMMEDIATELY
      const query = `
        SELECT r.${permissionColumn} as is_allowed
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;

      const result = await pool.query(query, [userId]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: "User role not found." });
      }

      // Check if the column is TRUE
      if (!result.rows[0].is_allowed) {
        return res.status(403).json({ 
          error: "Access Denied: You do not have permission to perform this action." 
        });
      }

      next();
    } catch (err) {
      console.error("Permission Check Error:", err);
      return res.status(500).json({ error: "Server error during permission check." });
    }
  };
};