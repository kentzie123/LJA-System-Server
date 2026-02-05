import express from "express";
import {
  getOvertimeTypes,
  getAllOvertime,
  getOvertimeStats, // Import the new controller
  createOvertimeRequest,
  createAdminOvertimeRequest,
  deleteOvertimeRequest,
  updateOvertimeRequest,
  updateOvertimeStatus,
} from "../controllers/overtime.controller.js";

// Import your custom middleware
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. All routes require valid login
router.use(verifyToken);

// --- OPEN ROUTES (Common Data) ---
router.get("/types", getOvertimeTypes);

// --- STATS ROUTE (New) ---
// We use 'perm_overtime_view' as the base permission to see the dashboard
router.get(
  "/stats", 
  checkPermission("perm_overtime_view"), 
  getOvertimeStats
);

// --- STANDARD EMPLOYEE ACTIONS ---

router.post(
  "/create", 
  checkPermission("perm_overtime_create"), 
  createOvertimeRequest
);

router.get(
  "/all", 
  checkPermission("perm_overtime_view"), 
  getAllOvertime
);

router.delete("/:id", deleteOvertimeRequest);
router.put("/:id/update", updateOvertimeRequest);

// --- ADMIN / HR ACTIONS ---

router.post(
  "/create-admin",
  checkPermission("perm_overtime_manage"),
  createAdminOvertimeRequest
);

router.put(
  "/:id/status", 
  checkPermission("perm_overtime_approve"), 
  updateOvertimeStatus
);

export default router;