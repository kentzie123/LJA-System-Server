import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { login, checkAuth, logout } from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.get("/check-auth", verifyToken, checkAuth);

export default router;
