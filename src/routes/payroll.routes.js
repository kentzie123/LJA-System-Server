import { Router } from "express";
import {
  createPayRun,
  getAllPayRuns,
  deletePayrun
} from "../controllers/payroll.controller.js";

import { requireRole } from "../middleware/roleVerificationToken.js";

const router = Router();

router.get("/", requireRole(1, 3), getAllPayRuns);

router.post("/create", requireRole(1, 3), createPayRun);

router.delete("/:id", requireRole(1,3), deletePayrun);

export default router;
