import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { fetchBranches } from "../controllers/branch.controller.js";

const router = express.Router();

// GET /api/branches
router.get("/", verifyToken, fetchBranches);

export default router;
