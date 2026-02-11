import * as LeaveService from "../services/leave.service.js";

// ==========================================
// HELPER: CENTRALIZED LEAVE SOCKET EMITTER
// ==========================================
const emitLeaveUpdate = (req, type, leaveData) => {
  const payload = { type, data: leaveData };

  // 1. Notify Admins (Populates the "Leave Requests" table)
  req.io.to("admin_room").emit("leave_update", payload);

  // 2. Notify the Specific Employee (Updates their "My Leaves" & Balance)
  // We check for user_id to ensure we target the correct private room
  if (leaveData && leaveData.user_id) {
    req.io.to(`user_${leaveData.user_id}`).emit("leave_update", payload);
  }
};

// --- READ / VIEW ONLY ---

export const getLeaveTypes = async (req, res) => {
  try {
    const types = await LeaveService.getAllLeaveTypes();
    res.status(200).json(types);
  } catch (error) {
    res.status(500).json({ message: error.message });
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

// --- ACTIONS WITH REAL-TIME EMISSIONS ---

// POST /api/leaves/create
export const createLeaveRequest = async (req, res) => {
  try {
    const { leaveTypeId, startDate, endDate, reason } = req.body;
    const userId = req.user.userId;

    if (!leaveTypeId || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 1. Create Record
    const newRequest = await LeaveService.createLeaveRequest({
      userId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    });

    // 2. Fetch Full Data (Join User/Type) for Socket
    const fullRequest = await LeaveService.getLeaveById(newRequest.id);

    // 3. Emit
    emitLeaveUpdate(req, "NEW_REQUEST", fullRequest);

    res.status(201).json({
      message: "Leave request submitted successfully",
      data: fullRequest,
    });
  } catch (error) {
    console.error("Create Leave Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// POST /api/leaves/create-admin
export const createAdminLeaveRequest = async (req, res) => {
  try {
    const { targetUserId, leaveTypeId, startDate, endDate, reason } = req.body;
    const roleId = req.user.role_id;

    if (roleId !== 1 && roleId !== 3) {
      return res.status(403).json({ message: "Unauthorized. Admin access required." });
    }

    if (!targetUserId || !leaveTypeId || !startDate || !endDate || !reason) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 1. Create Record
    const newRequest = await LeaveService.createAdminLeaveRequest({
      targetUserId,
      leaveTypeId,
      startDate,
      endDate,
      reason,
    });

    // 2. Fetch Full Data
    const fullRequest = await LeaveService.getLeaveById(newRequest.id);

    // 3. Emit (This notifies the target user instantly)
    emitLeaveUpdate(req, "ADMIN_ASSIGNED", fullRequest);

    res.status(201).json({
      message: "Leave assigned successfully",
      data: fullRequest,
    });
  } catch (error) {
    console.error("Admin Create Leave Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// PUT /leave/:id/status (Approve/Reject)
export const updateLeaveStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // 1. Update DB
    await LeaveService.updateLeaveStatus(id, status, rejectionReason);
    
    // 2. Fetch Updated Record
    const updatedRequest = await LeaveService.getLeaveById(id);

    // 3. Emit (Notifies user: "Approved" or "Rejected")
    emitLeaveUpdate(req, "STATUS_UPDATE", updatedRequest);

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
      return res.status(403).json({ message: "You can only delete Pending requests." });
    }

    // 1. Delete
    await LeaveService.deleteLeave(id);

    // 2. Emit (Using the fetched 'leave' object so we know who to notify)
    emitLeaveUpdate(req, "DELETE", leave);

    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /leave/:id/update (Edit Request)
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

    // 1. Update
    const updated = await LeaveService.updateLeave(id, data);
    
    // 2. Fetch Full
    const full = await LeaveService.getLeaveById(updated.id);

    // 3. Emit
    emitLeaveUpdate(req, "UPDATE", full);

    res.status(200).json({ message: "Request updated", data: full });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};