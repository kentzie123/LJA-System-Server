import express from "express";
import {
  createOvertimeRequest,
  getAllOvertime,
  deleteOvertimeRequest,
  updateOvertimeRequest,
  updateOvertimeStatus
} from "../controllers/overtime.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.use(verifyToken);

router.get("/all", getAllOvertime);
router.post("/create", createOvertimeRequest);
router.delete("/:id", deleteOvertimeRequest);
router.put("/:id/update", updateOvertimeRequest); // For editing details
router.put("/:id/status", updateOvertimeStatus);  // For Approve/Reject

export default router;