import { Router } from "express";
import {
  createPayRun,
  getAllPayRuns,
  deletePayRun,
  getPayRunDetails,
  getAllRecords,
  getMyRecords,
  approvePayRun,
} from "../controllers/payroll.controller.js";

import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(verifyToken);

// ==========================================
// VIEW / READ ROUTES
// ==========================================

// Managers see Drafts/All; Employees see only Approved list
router.get("/", checkPermission("perm_payroll_view"), getAllPayRuns);

// Strictly for the logged-in user's own history
router.get("/history/my", checkPermission("perm_payroll_view"), getMyRecords);

// Admin-only view for the entire company history
router.get(
  "/history/all",
  checkPermission("perm_payroll_view_all"),
  getAllRecords,
);

router.get("/:id", getPayRunDetails);

// ==========================================
// MANAGEMENT ROUTES (HR / ADMIN)
// ==========================================

router.post("/create", checkPermission("perm_payroll_manage"), createPayRun);

router.delete("/:id", checkPermission("perm_payroll_manage"), deletePayRun);

// Finalizing the run and pushing to ledger
router.put(
  "/:id/approve",
  checkPermission("perm_payroll_approve"),
  approvePayRun,
);

export default router;
