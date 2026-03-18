import express from "express";
import {
  getOvertimeTypes,
  getAllOvertime,
  getOvertimeStats,
  createOvertimeRequest,
  createAdminOvertimeRequest,
  deleteOvertimeRequest,
  updateOvertimeRequest,
  updateOvertimeStatus,
} from "../controllers/overtime.controller.js";

import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// ========================================
// GLOBAL AUTH
// ========================================
router.use(verifyToken);

// ========================================
// COMMON DATA
// ========================================
router.get("/types", getOvertimeTypes);

// ========================================
// DASHBOARD STATS
// ========================================
router.get(
  "/stats",
  checkPermission("perm_overtime_view"),
  getOvertimeStats
);

// ========================================
// EMPLOYEE ROUTES
// ========================================

// Create OT request
router.post(
  "/create",
  checkPermission("perm_overtime_create"),
  createOvertimeRequest
);

// View overtime
router.get(
  "/all",
  checkPermission("perm_overtime_view"),
  getAllOvertime
);

// Update request
router.put(
  "/:id/update",
  verifyToken,
  updateOvertimeRequest
);

// Delete request
router.delete(
  "/:id",
  verifyToken,
  deleteOvertimeRequest
);

// ========================================
// ADMIN / HR ROUTES
// ========================================

// Assign overtime
router.post(
  "/create-admin",
  checkPermission("perm_overtime_manage"),
  createAdminOvertimeRequest
);

// Approve / Reject
router.put(
  "/:id/status",
  checkPermission("perm_overtime_approve"),
  updateOvertimeStatus
);

export default router;