import { Router } from "express";
import {
  createPayRun,
  getAllPayRuns,
  deletePayRun,
  getPayRunDetails,
  getAllRecords,
  getMyRecords,
  approvePayRun // <-- Imported this
} from "../controllers/payroll.controller.js";

// Import the new unified middleware
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = Router();

// 1. All routes require a valid login token first
router.use(verifyToken);

// ==========================================
// VIEW / READ ROUTES
// ==========================================

router.get("/", checkPermission("perm_payroll_view"), getAllPayRuns);

router.get("/history/my", checkPermission("perm_payroll_view"), getMyRecords);

router.get(
  "/history/all",
  checkPermission("perm_payroll_view_all"),
  getAllRecords,
);

router.get("/:id", checkPermission("perm_payroll_view"), getPayRunDetails);

// ==========================================
// MANAGEMENT ROUTES (HR / ADMIN)
// ==========================================

router.post("/create", checkPermission("perm_payroll_manage"), createPayRun);

router.delete("/:id", checkPermission("perm_payroll_manage"), deletePayRun);

// NEW: Approve Pay Run / Mark as Finalized
router.put(
  "/:id/approve",
  checkPermission("perm_payroll_approve"),
  approvePayRun
);

export default router;