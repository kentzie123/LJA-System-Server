import express from "express";
import { 
  getRoles, 
  updateRolePermissions, 
  createRole, 
  deleteRole 
} from "../controllers/role.controller.js";

// FIXED IMPORT:
import { verifyToken } from "../middleware/verifyToken.js"; 

const router = express.Router();

router.get("/", verifyToken, getRoles);
router.post("/", verifyToken, createRole);
router.put("/:id", verifyToken, updateRolePermissions);
router.delete("/:id", verifyToken, deleteRole);

export default router;