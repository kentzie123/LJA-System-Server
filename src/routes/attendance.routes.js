import express from "express";
import {
  createManualEntry,
  getAllAttendance,
  deleteAttendance,
  updateAttendance,
  clockIn,
  clockOut,
  getStatus,
  verifyAttendance,
  verifyWorkday,
  adminClockOverride,
  getCalendarData
} from "../controllers/attendance.contoller.js";
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";
import { requireRole } from "../middleware/roleVerificationToken.js";

const router = express.Router();

// --- ADMIN / MANAGER ROUTES (Protected by Permissions) ---

// 1. View All Attendance Logs
// Checks 'perm_attendance_view'
router.get(
  "/",
  verifyToken,
  checkPermission("perm_attendance_view"),
  getAllAttendance,
);

router.get(
  "/calendar",
  verifyToken,
  checkPermission("perm_attendance_view"),
  getCalendarData,
);

// 2. Manual Entry (Add Log manually)
// Checks 'perm_attendance_manual'
router.post(
  "/manual",
  verifyToken,
  checkPermission("perm_attendance_manual"),
  createManualEntry,
);

// 3. Update/Edit Existing Log
// Checks 'perm_attendance_manual' (Treating edit as a manual intervention)
router.put(
  "/:id",
  verifyToken,
  checkPermission("perm_attendance_manual"),
  updateAttendance,
);

// 4. Delete Log
// Checks 'perm_attendance_manual' (or you could create a specific delete perm)
router.delete(
  "/:id",
  verifyToken,
  checkPermission("perm_attendance_manual"),
  deleteAttendance,
);

// 5. Verify / Approve Log
// Checks 'perm_attendance_verify'
router.put(
  "/verify/:id",
  verifyToken,
  checkPermission("perm_attendance_verify"),
  verifyAttendance,
);

router.put(
  "/verify-day/:id",
  verifyToken,
  checkPermission("perm_attendance_verify"),
  verifyWorkday,
);

// --- SUPER ADMIN ROUTES ---

// Admin Clock In/Out Override (Restricted to Super Admin Role ID: 3)
// Note: Depending on how your requireRole is written, it might need to be requireRole([3])
router.post(
  "/admin-override", 
  verifyToken, 
  requireRole(3), 
  adminClockOverride
);

// --- EMPLOYEE SELF-SERVICE (Available to ALL logged-in users) ---
// These do NOT check specific role permissions because all employees need to clock in.

router.post("/clock-in", verifyToken, clockIn);
router.post("/clock-out", verifyToken, clockOut);
router.get("/status/current", verifyToken, getStatus);

export default router;