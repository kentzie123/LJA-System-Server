import * as LeaveService from "../services/leave.service.js";
import pool from "../config/db.js";

// GET /api/leaves/types
export const getLeaveTypes = async (req, res) => {
  try {
    const types = await LeaveService.getAllLeaveTypes();
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// POST /api/leaves/create
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

export const getBalances = async (req, res) => {
  try {
    const balances = await LeaveService.getUserBalances(req.user.userId);
    res.status(200).json(balances);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch balances" });
  }
};

export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Call the Service function
    const updatedRequest = await LeaveService.updateLeaveStatus(id, status);

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
    const roleId = req.user.role_id; // Retrieve Role from Token

    // 1. Fetch request to check status
    const leave = await LeaveService.getLeaveById(id);
    if (!leave) return res.status(404).json({ message: "Request not found" });

    // 2. PERMISSION CHECK
    const isAdmin = roleId === 1 || roleId === 3;

    // If NOT admin AND status is NOT Pending -> Block
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
    const { status } = req.body; // "Approved" or "Rejected"

    // OLD CODE (Delete this):
    // const result = await pool.query(...)

    // NEW CODE: Call the Service function that handles the deduction logic
    const updatedRequest = await LeaveService.updateLeaveStatus(id, status);

    res.status(200).json({
      message: `Request ${status} successfully`,
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: error.message || "Internal server error" });
  }
};
