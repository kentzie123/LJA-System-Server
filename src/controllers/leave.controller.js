import * as LeaveService from "../services/leave.service.js";

// GET /api/leaves/types
export const getLeaveTypes = async (req, res) => {
  try {
    const types = await LeaveService.getAllLeaveTypes();
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/leaves/create (Standard Employee Request)
export const createLeaveRequest = async (req, res) => {
  try {
    const { leaveTypeId, startDate, endDate, reason } = req.body;
    const userId = req.user.userId;

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newRequest = await LeaveService.createLeaveRequest({
      userId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    });

    res.status(201).json({
      message: "Leave request submitted successfully",
      data: newRequest,
    });
  } catch (error) {
    console.error("Create Leave Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// POST /api/leaves/create-admin (Admin Assign Leave)
export const createAdminLeaveRequest = async (req, res) => {
  try {
    const { targetUserId, leaveTypeId, startDate, endDate, reason } = req.body;
    const roleId = req.user.role_id;

    // Strict Admin Check (1=Admin, 3=SuperAdmin)
    if (roleId !== 1 && roleId !== 3) {
      return res
        .status(403)
        .json({ message: "Unauthorized. Admin access required." });
    }

    if (!targetUserId || !leaveTypeId || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newRequest = await LeaveService.createAdminLeaveRequest({
      targetUserId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    });

    res.status(201).json({
      message: "Leave assigned successfully",
      data: newRequest,
    });
  } catch (error) {
    console.error("Admin Create Leave Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// GET /api/leaves/all
export const getAllLeaves = async (req, res) => {
  try {
    const userId = req.user.userId;
    const roleId = req.user.role_id;

    const leaves = await LeaveService.getAllLeaves(userId, roleId);
    res.status(200).json(leaves);
  } catch (error) {
    console.error("Fetch Leaves Error:", error);
    res.status(500).json({ message: "Failed to fetch leave records." });
  }
};

// GET /api/leaves/balances
export const getBalances = async (req, res) => {
  try {
    const balances = await LeaveService.getUserBalances(req.user.userId);
    res.status(200).json(balances);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch balances" });
  }
};

// PUT /leave/:id/status
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    const updatedRequest = await LeaveService.updateLeaveStatus(
      id,
      status,
      rejectionReason,
    );

    res.status(200).json({
      message: `Request ${status} successfully`,
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};

// DELETE /leave/:id
export const deleteLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const roleId = req.user.role_id;
    const userId = req.user.userId;

    const leave = await LeaveService.getLeaveById(id);
    if (!leave) return res.status(404).json({ message: "Request not found" });

    const isAdmin = roleId === 1 || roleId === 3;
    const isOwner = leave.user_id === userId;

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    if (!isAdmin && leave.status !== "Pending") {
      return res
        .status(403)
        .json({ message: "You can only delete Pending requests." });
    }

    await LeaveService.deleteLeave(id);
    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /leave/:id/update
export const updateLeaveRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;
    const userId = req.user.userId;
    const roleId = req.user.role_id;

    const leave = await LeaveService.getLeaveById(id);
    if (!leave) return res.status(404).json({ message: "Request not found" });

    const isAdmin = roleId === 1 || roleId === 3;

    if (leave.user_id !== userId && !isAdmin) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    const updated = await LeaveService.updateLeave(id, data);
    res.status(200).json({ message: "Request updated", data: updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


export const getLeaveStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const roleId = req.user.role_id;

    const stats = await LeaveService.getLeaveStats(userId, roleId);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Fetch Leave Stats Error:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
};