import { Router } from "express";
import {
  createDeduction,
  getAllPlans,
  updatePlan,
  deletePlan,
  updateSubscribers,
} from "../controllers/deduction.controller.js";

import { requireRole } from "../middleware/roleVerificationToken.js";

const router = Router();

// 1. Create Deduction Plan
router.post("/create", requireRole(1, 3), createDeduction);

// 2. Get All Plans (Replaces the old separate global/user routes)
router.get("/all", requireRole(1, 3), getAllPlans);

// 3. Update Plan (Edit Name, Amount, or Status)
router.patch("/:id", requireRole(1, 3), updatePlan);

// 4. Delete Plan
router.delete("/:id", requireRole(1, 3), deletePlan);

// 5. Manage Subscribers (Add/Remove Users from a Plan)
router.post("/:id/subscribers", requireRole(1, 3), updateSubscribers);

export default router;
