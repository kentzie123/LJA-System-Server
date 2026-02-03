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
} from "../controllers/attendance.contoller.js";
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// --- ADMIN / MANAGER ROUTES (Protected by Permissions) ---

// 1. View All Attendance Logs
// Checks 'perm_attendance_view'
router.get(
  "/", 
  verifyToken, 
  checkPermission("perm_attendance_view"), 
  getAllAttendance
);

// 2. Manual Entry (Add Log manually)
// Checks 'perm_attendance_manual'
router.post(
  "/manual", 
  verifyToken, 
  checkPermission("perm_attendance_manual"), 
  createManualEntry
);

// 3. Update/Edit Existing Log
// Checks 'perm_attendance_manual' (Treating edit as a manual intervention)
router.put(
  "/:id", 
  verifyToken, 
  checkPermission("perm_attendance_manual"), 
  updateAttendance
);

// 4. Delete Log
// Checks 'perm_attendance_manual' (or you could create a specific delete perm)
router.delete(
  "/:id", 
  verifyToken, 
  checkPermission("perm_attendance_manual"), 
  deleteAttendance
);

// 5. Verify / Approve Log
// Checks 'perm_attendance_verify'
router.put(
  "/verify/:id", 
  verifyToken, 
  checkPermission("perm_attendance_verify"), 
  verifyAttendance
);


// --- EMPLOYEE SELF-SERVICE (Available to ALL logged-in users) ---
// These do NOT check specific role permissions because all employees need to clock in.

router.post("/clock-in", verifyToken, clockIn);
router.post("/clock-out", verifyToken, clockOut);
router.get("/status/current", verifyToken, getStatus);

export default router;