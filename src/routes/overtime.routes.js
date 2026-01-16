import express from "express";
import {
  getOvertimeTypes,
  getAllOvertime,
  createOvertimeRequest,
  deleteOvertimeRequest,
  updateOvertimeRequest,
  updateOvertimeStatus,
} from "../controllers/overtime.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// Apply Auth Middleware to all routes
router.use(verifyToken);

// Routes
router.get("/types", getOvertimeTypes);       // Fetch dropdown options
router.get("/all", getAllOvertime);           // Fetch table data
router.post("/create", createOvertimeRequest); // Submit form

router.delete("/:id", deleteOvertimeRequest);  // Delete
router.put("/:id/update", updateOvertimeRequest); // Edit Details
router.put("/:id/status", updateOvertimeStatus);  // Approve/Reject

export default router;