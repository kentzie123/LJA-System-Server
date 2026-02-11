import { Router } from "express";
import {
  createDeduction,
  getAllPlans,
  updatePlan,
  deletePlan,
  updateSubscribers,
  toggleStatus, // Import the new controller
} from "../controllers/deduction.controller.js";

import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(verifyToken);

// READ
router.get("/", checkPermission("perm_deduction_view"), getAllPlans);

// WRITE
router.post(
  "/create",
  checkPermission("perm_deduction_manage"),
  createDeduction,
);
router.put("/:id", checkPermission("perm_deduction_manage"), updatePlan);
router.delete("/:id", checkPermission("perm_deduction_manage"), deletePlan);
router.put(
  "/:id/subscribers",
  checkPermission("perm_deduction_manage"),
  updateSubscribers,
);

// TOGGLE STATUS -- ADDED THIS
router.patch(
  "/:id/status",
  checkPermission("perm_deduction_manage"),
  toggleStatus,
);

export default router;
