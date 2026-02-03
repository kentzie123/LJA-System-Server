import express from "express";
import { verifyToken } from "../middleware/authMiddleware.js"; // Updated import path
import { fetchRoles, modifyRole } from "../controllers/role.controller.js";

const router = express.Router();

// GET /api/roles - Fetch all roles & permissions
router.get("/", verifyToken, fetchRoles);

// PUT /api/roles/:id - Update permissions
router.put("/:id", verifyToken, modifyRole);

export default router;