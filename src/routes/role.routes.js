import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { fetchRoles } from "../controllers/role.controller.js";

const router = express.Router();

// GET /api/roles
router.get("/", verifyToken, fetchRoles);

export default router;
