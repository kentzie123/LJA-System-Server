import * as roleService from "../services/role.service.js";

// Get All
export const getRoles = async (req, res) => {
  try {
    const roles = await roleService.getAllRoles();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create
export const createRole = async (req, res) => {
  try {
    const { role_name } = req.body;
    
    if (!role_name) {
      return res.status(400).json({ message: "Role name is required" });
    }

    const newRole = await roleService.createRole(role_name);
    res.status(201).json(newRole);
  } catch (error) {
    // Handle duplicate error gracefully
    if (error.message === "Role already exists") {
      return res.status(409).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

// Update
export const updateRolePermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRole = await roleService.updateRole(id, req.body);
    res.json(updatedRole);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete
export const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    await roleService.deleteRole(id);
    res.json({ message: "Role deleted successfully" });
  } catch (error) {
    // Catch the specific safety errors we threw in the service
    if (error.message.includes("Cannot delete") || error.message.includes("System Admin")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};