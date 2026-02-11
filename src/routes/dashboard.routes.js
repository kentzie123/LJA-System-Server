import { Router } from "express";
import {
  getAdminDashboard,
  getEmployeeDashboard,
} from "../controllers/dashboard.controller.js";

// Import Middleware
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = Router();

router.use(verifyToken);

router.get("/admin", checkPermission("perm_dashboard_view"), getAdminDashboard);

router.get("/employee", getEmployeeDashboard);

export default router;
