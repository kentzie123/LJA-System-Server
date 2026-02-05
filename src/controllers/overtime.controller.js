import * as OvertimeService from "../services/overtime.service.js";

// GET /api/overtime/types
export const getOvertimeTypes = async (req, res) => {
  try {
    const types = await OvertimeService.getAllOvertimeTypes();
    res.status(200).json(types);
  } catch (error) {
    console.error("Fetch Types Error:", error);
    res.status(500).json({ message: "Failed to fetch overtime types" });
  }
};

// GET /api/overtime/all
export const getAllOvertime = async (req, res) => {
  try {
    const userId = req.user.userId;
    const roleId = req.user.role_id;
    const records = await OvertimeService.getAllOvertime(userId, roleId);
    res.status(200).json(records);
  } catch (error) {
    console.error("Fetch Overtime Error:", error);
    res.status(500).json({ message: "Failed to fetch overtime records." });
  }
};

// POST /api/overtime/create (Standard Employee Request)
export const createOvertimeRequest = async (req, res) => {
  try {
    const { date, startTime, endTime, reason, otTypeId } = req.body;
    const userId = req.user.userId;

    // Basic Validation
    if (!date || !startTime || !endTime || !reason || !otTypeId) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newRequest = await OvertimeService.createOvertimeRequest({
      userId,
      date,
      startTime,
      endTime,
      reason,
      otTypeId,
    });

    res.status(201).json({
      message: "Overtime request submitted",
      data: newRequest,
    });
  } catch (error) {
    console.error("Create Overtime Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// POST /api/overtime/create-admin (Admin Assign Overtime)
export const createAdminOvertimeRequest = async (req, res) => {
  try {
    const { targetUserId, date, startTime, endTime, reason, otTypeId } = req.body;
    
    // Note: Permission check (perm_overtime_manage) is handled by the route middleware

    // Basic Validation
    if (!targetUserId || !date || !startTime || !endTime || !reason || !otTypeId) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newRequest = await OvertimeService.createAdminOvertimeRequest({
      targetUserId,
      date,
      startTime,
      endTime,
      reason,
      otTypeId,
    });

    res.status(201).json({
      message: "Overtime assigned successfully",
      data: newRequest,
    });
  } catch (error) {
    console.error("Admin Create Overtime Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// DELETE /api/overtime/:id
export const deleteOvertimeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const roleId = req.user.role_id;
    const userId = req.user.userId;

    // Check if request exists
    const request = await OvertimeService.getOvertimeById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    // Permissions: Admin can delete anything; User can only delete THEIR OWN Pending requests
    const isAdmin = roleId === 1 || roleId === 3;
    const isOwner = request.user_id === userId;

    if (!isAdmin && !isOwner) {
       return res.status(403).json({ message: "Unauthorized action." });
    }

    if (!isAdmin && request.status !== "Pending") {
      return res
        .status(403)
        .json({ message: "You can only delete Pending requests." });
    }

    await OvertimeService.deleteOvertime(id);
    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    console.error("Delete Overtime Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/overtime/:id/update (Edit Details)
export const updateOvertimeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body; // { date, startTime, endTime, reason, otTypeId }
    const roleId = req.user.role_id;
    const userId = req.user.userId;

    const request = await OvertimeService.getOvertimeById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const isAdmin = roleId === 1 || roleId === 3;
    
    // Check Ownership
    if (!isAdmin && request.user_id !== userId) {
        return res.status(403).json({ message: "Unauthorized action." });
    }

    // Check Status (Only Pending can be edited by non-admins)
    if (!isAdmin && request.status !== "Pending") {
      return res
        .status(403)
        .json({ message: "You can only edit Pending requests." });
    }

    const updated = await OvertimeService.updateOvertime(id, data);
    res.status(200).json({ message: "Request updated", data: updated });
  } catch (error) {
    console.error("Update Overtime Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/overtime/:id/status (Approve/Reject)
export const updateOvertimeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body; // "Approved" or "Rejected"

    const updated = await OvertimeService.updateOvertimeStatus(
      id,
      status,
      rejectionReason
    );
    res.status(200).json({ message: `Request ${status}`, data: updated });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getOvertimeStats = async (req, res) => {
  try {
    // req.user is populated by your verifyToken middleware
    const userId = req.user.userId;
    const roleId = req.user.role_id;

    const stats = await OvertimeService.getOvertimeStats(userId, roleId);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Fetch Stats Error:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
};