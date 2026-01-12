import express from "express";
import { requireRole } from "../middleware/roleVerificationToken.js";
import {
  fetchAllUsers,
  createUser,
  deleteUser,
  updateUser,
} from "../controllers/user.controller.js";

const router = express.Router();

router.get("/fetch-all", requireRole(1, 3), fetchAllUsers);
router.post("/create-user", requireRole(1, 3), createUser);
router.delete("/delete-user/:id", requireRole(1, 3), deleteUser);
router.put("/update-user/:id", requireRole(1, 3), updateUser);

export default router;
