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
import { verifyToken } from "../middleware/verifyToken.js";
import { requireRole } from "../middleware/roleVerificationToken.js";

const router = express.Router();

// Clocking Actions
router.post("/manual", requireRole(1, 3), createManualEntry);

// Data Fetching
router.get("/", requireRole(1, 3), getAllAttendance);

// Management Actions (Edit/Delete/Verify)
router.put("/:id", requireRole(1, 3), updateAttendance);
router.delete("/:id", requireRole(1, 3), deleteAttendance);
router.put("/verify/:id", requireRole(1, 3), verifyAttendance);

// User Clocking Actions
router.post("/clock-in", verifyToken, clockIn);
router.post("/clock-out", verifyToken, clockOut);
router.get("/status/current", verifyToken, getStatus);

export default router;
