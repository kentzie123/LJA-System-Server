import express from "express";
import {
  getLeaveTypes,
  getAllLeaves,
  getBalances,
  getLeaveStats, // Import the new stats controller
  createLeaveRequest,
  createAdminLeaveRequest,
  updateLeaveStatus,
  deleteLeaveRequest,
  updateLeaveRequest,
} from "../controllers/leave.controller.js";

import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// 1. All routes require valid login token
router.use(verifyToken);

// --- OPEN ROUTES (Common Data) ---
router.get("/types", getLeaveTypes);
router.get("/balances", getBalances);

// --- STATS ROUTE (Must be before /:id routes) ---
router.get(
  "/stats", 
  checkPermission("perm_leave_view"), 
  getLeaveStats
);

// --- STANDARD EMPLOYEE ACTIONS ---

// 1. Create Own Request -> Requires 'perm_leave_create'
router.post(
  "/create", 
  checkPermission("perm_leave_create"), 
  createLeaveRequest
);

// 2. Fetch History -> Requires 'perm_leave_view'
router.get(
  "/all", 
  checkPermission("perm_leave_view"), 
  getAllLeaves
);

// 3. Edit/Delete Own Pending Requests (Controller checks ownership)
router.delete("/:id", deleteLeaveRequest);
router.put("/:id/update", updateLeaveRequest);

// --- ADMIN / HR ACTIONS ---

// 1. Admin Assign Leave to Others -> Requires 'perm_leave_manage'
router.post(
  "/create-admin",
  checkPermission("perm_leave_manage"),
  createAdminLeaveRequest
);

// 2. Approve or Reject Requests -> Requires 'perm_leave_approve'
router.put(
  "/:id/status", 
  checkPermission("perm_leave_approve"), 
  updateLeaveStatus
);

export default router;