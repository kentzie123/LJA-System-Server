import express from "express";
import { 
  getRoles, 
  getSystemRoles, // NEW IMPORT
  updateRolePermissions, 
  createRole, 
  deleteRole 
} from "../controllers/role.controller.js";

import { verifyToken } from "../middleware/verifyToken.js"; 

const router = express.Router();

// 1. Get Filtered Roles (Standard View - No Super Admin)
router.get("/", verifyToken, getRoles);

// 2. Get Unfiltered Roles (System View - Includes Super Admin)
router.get("/system", verifyToken, getSystemRoles);

// 3. Create New Role
router.post("/", verifyToken, createRole);

// 4. Update Permissions
router.put("/:id", verifyToken, updateRolePermissions);

// 5. Delete Role
router.delete("/:id", verifyToken, deleteRole);

export default router;