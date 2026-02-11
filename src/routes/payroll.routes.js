import { Router } from "express";
import {
  createPayRun,
  getAllPayRuns,
  deletePayRun,
  getPayRunDetails,
  getAllRecords,
  getMyRecords,
  // You likely have an update status/approve route, e.g., updatePayRunStatus
  // updatePayRunStatus
} from "../controllers/payroll.controller.js";

// Import the new unified middleware
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = Router();

// 1. All routes require a valid login token first
router.use(verifyToken);

// ==========================================
// VIEW / READ ROUTES
// ==========================================

// Get List of Pay Runs (e.g., "January 1-15", "January 16-31")
// Permission: 'perm_payroll_view'
// Note: The controller must filter the data inside.
// Admins see all totals; Employees just see that the run exists or their own slip status.
router.get("/", checkPermission("perm_payroll_view"), getAllPayRuns);

// Get My Personal History
// Permission: 'perm_payroll_view' (Basic access)
router.get("/history/my", checkPermission("perm_payroll_view"), getMyRecords);

// Get Global History (All Employees)
// Permission: 'perm_payroll_view_all' (Manager/Admin only)
router.get(
  "/history/all",
  checkPermission("perm_payroll_view_all"),
  getAllRecords,
);

// Get Details of a Specific Pay Run (The Payslips inside it)
// Permission: 'perm_payroll_view'
// Note: Controller needs logic to return ONLY the user's payslip if they don't have 'view_all'
router.get("/:id", checkPermission("perm_payroll_view"), getPayRunDetails);

// ==========================================
// MANAGEMENT ROUTES (HR / ADMIN)
// ==========================================

// Create a New Pay Run (Calculate Salaries)
// Permission: 'perm_payroll_manage'
router.post("/create", checkPermission("perm_payroll_manage"), createPayRun);

// Delete a Pay Run (Rollback)
// Permission: 'perm_payroll_manage'
router.delete("/:id", checkPermission("perm_payroll_manage"), deletePayRun);

// (Optional) Approve Pay Run / Mark as Paid
// If you have a route for this, use 'perm_payroll_approve'
// router.put(
//   "/:id/status",
//   checkPermission("perm_payroll_approve"),
//   updatePayRunStatus
// );

export default router;
