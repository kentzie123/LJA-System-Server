import express from "express";
import {
  createLeaveRequest,
  getLeaveTypes,
  getAllLeaves,
  getBalances,
  updateLeaveStatus,
  deleteLeaveRequest,
  updateLeaveRequest,
} from "../controllers/leave.controller.js";

// Make sure we import checkPermission here
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. All routes require valid login
router.use(verifyToken);

// --- OPEN ROUTES (Accessible to all Employees) ---
router.get("/types", getLeaveTypes);
router.post("/create", createLeaveRequest);
router.get("/balances", getBalances);

// Note: We don't restrict '/all' with middleware because the Controller 
// handles the logic: Admins see ALL, Employees see ONLY THEIR OWN.
router.get("/all", getAllLeaves); 

// Users can Edit/Delete their OWN pending requests (Controller checks ownership)
router.delete("/:id", deleteLeaveRequest);
router.put("/:id/update", updateLeaveRequest);

// --- RESTRICTED ROUTES (Requires Permissions) ---

// 2. Only users with 'perm_leave_approve' can Approve/Reject
router.put(
  "/:id/status", 
  checkPermission("perm_leave_approve"), 
  updateLeaveStatus
);

export default router;