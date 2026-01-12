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
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

router.use(verifyToken);

router.get("/types", getLeaveTypes);
router.post("/create", createLeaveRequest);
router.get("/all", getAllLeaves);
router.get("/balances", getBalances);
router.put("/:id/status", updateLeaveStatus);
router.delete("/:id", deleteLeaveRequest);
router.put("/:id/update", updateLeaveRequest);

export default router;
