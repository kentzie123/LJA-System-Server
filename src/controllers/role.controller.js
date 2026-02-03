import * as roleService from "../services/role.service.js";

// 1. Fetch All Roles
export const fetchRoles = async (req, res) => {
  try {
    const roles = await roleService.getAllRoles();
    res.status(200).json(roles);
  } catch (err) {
    console.error("Error fetching roles:", err);
    res.status(500).json({ error: "Failed to fetch roles" });
  }
};

// 2. Update Role Permissions
export const modifyRole = async (req, res) => {
  try {
    const { id } = req.params;
    const permissions = req.body; // Expects { perm_employee_view: true, ... }

    const updatedRole = await roleService.updateRole(id, permissions);

    if (!updatedRole) {
      return res.status(404).json({ error: "Role not found" });
    }

    res.status(200).json({
      message: "Role permissions updated successfully",
      role: updatedRole,
    });
  } catch (err) {
    console.error("Error updating role:", err);
    res.status(500).json({ error: "Failed to update role" });
  }
};