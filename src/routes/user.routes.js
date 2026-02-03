import express from "express";
import {
  fetchAllUsers,
  createUser,
  deleteUser,
  updateUser,
  uploadProfilePicture,
  updatePersonalProfile
} from "../controllers/user.controller.js";

// Import the new middleware from the file you just created
import { verifyToken, checkPermission } from "../middleware/authMiddleware.js";

const router = express.Router();

// --- ADMIN / HR MANAGEMENT ROUTES (Protected by Permissions) ---

// 1. View Employee List
// Checks if the user's role has 'perm_employee_view' = true
router.get(
  "/fetch-all", 
  verifyToken, 
  checkPermission("perm_employee_view"), 
  fetchAllUsers
);

// 2. Create New Employee
// Checks for 'perm_employee_create'
router.post(
  "/create-user", 
  verifyToken, 
  checkPermission("perm_employee_create"), 
  createUser
);

// 3. Delete Employee
// Checks for 'perm_employee_delete'
router.delete(
  "/delete-user/:id", 
  verifyToken, 
  checkPermission("perm_employee_delete"), 
  deleteUser
);

// 4. Update Employee Details (Admin Edit)
// Checks for 'perm_employee_edit'
router.put(
  "/update-user/:id", 
  verifyToken, 
  checkPermission("perm_employee_edit"), 
  updateUser
);


// --- PERSONAL PROFILE ROUTES (Available to ALL logged-in users) ---

// Any logged-in user can update their own picture
router.put("/upload-picture", verifyToken, uploadProfilePicture);

// Any logged-in user can update their own name/email
router.put("/update-profile", verifyToken, updatePersonalProfile);

export default router;