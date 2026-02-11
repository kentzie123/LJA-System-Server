import { Router } from "express";
import {
  getAllAllowances,
  createAllowance,
  deleteAllowance,
  getSubscribers,
  updateSubscribers,
  toggleStatus
} from "../controllers/allowance.controller.js";
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(verifyToken);

// GET All (View)
router.get("/", checkPermission("perm_allowance_view"), getAllAllowances);

// CREATE (Manage)
router.post("/create", checkPermission("perm_allowance_manage"), createAllowance);

// DELETE (Manage)
router.delete("/:id", checkPermission("perm_allowance_manage"), deleteAllowance);

// GET Subscribers (View)
router.get("/:id/subscribers", checkPermission("perm_allowance_view"), getSubscribers);

// UPDATE Subscribers (Manage)
router.put("/:id/subscribers", checkPermission("perm_allowance_manage"), updateSubscribers);

// PAUSE/RESUME (Manage)
router.patch("/:id/status", checkPermission("perm_allowance_manage"), toggleStatus);

export default router;