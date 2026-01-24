import { Router } from "express";
import {
  createPayRun,
  getAllPayRuns,
  deletePayRun,
  getPayRunDetails,
  getAllRecords,
  getMyRecords
} from "../controllers/payroll.controller.js";

import { requireRole } from "../middleware/roleVerificationToken.js";
import { verifyToken } from "../middleware/verifyToken.js"; 

const router = Router();

router.get("/", requireRole(1, 3), getAllPayRuns);
router.post("/create", requireRole(1, 3), createPayRun);
router.get("/history/all", requireRole(1, 3), getAllRecords);
router.get("/history/my", verifyToken, getMyRecords);
router.get("/:id", requireRole(1, 3), getPayRunDetails);
router.delete("/:id", requireRole(1, 3), deletePayRun);

export default router;