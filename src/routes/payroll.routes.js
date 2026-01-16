import express from "express";
import {
  createPayRun,
  getAllPayRuns,
  getPayrollRecordsByRunId,
} from "../controllers/payroll.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Get all Pay Run history (The folders)
router.get("/", verifyToken, getAllPayRuns);

// Get specific employee records inside a Pay Run
router.get("/:id/records", verifyToken, getPayrollRecordsByRunId);

// Create a new Pay Run (The Calculation Engine)
router.post("/create", verifyToken, createPayRun);

export default router;
