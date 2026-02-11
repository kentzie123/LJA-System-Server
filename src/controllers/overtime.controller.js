import * as OvertimeService from "../services/overtime.service.js";

// ==========================================
// HELPER: CENTRALIZED OVERTIME SOCKET EMITTER
// ==========================================
const emitOvertimeUpdate = (req, type, otData) => {
  const payload = { type, data: otData };

  // 1. Notify Admins (For Team Approvals tab and badges)
  req.io.to("admin_room").emit("overtime_update", payload);

  // 2. Notify the Specific Employee (For their personal history)
  if (otData && otData.user_id) {
    req.io.to(`user_${otData.user_id}`).emit("overtime_update", payload);
  }
};

// --- READ / VIEW ONLY ---

export const getOvertimeTypes = async (req, res) => {
  try {
    const types = await OvertimeService.getAllOvertimeTypes();
    res.status(200).json(types);
  } catch (error) {
    console.error("Fetch Types Error:", error);
    res.status(500).json({ message: "Failed to fetch overtime types" });
  }
};

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

export const getOvertimeStats = async (req, res) => {
  try {
    const userId = req.user.userId;
    const roleId = req.user.role_id;
    const stats = await OvertimeService.getOvertimeStats(userId, roleId);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Fetch Stats Error:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
};

// --- ACTIONS WITH REAL-TIME EMISSIONS ---

// POST /api/overtime/create (Standard Employee Request)
export const createOvertimeRequest = async (req, res) => {
  try {
    const { date, startTime, endTime, reason, otTypeId } = req.body;
    const userId = req.user.userId;

    if (!date || !startTime || !endTime || !reason || !otTypeId) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 1. Create Record
    const newRequest = await OvertimeService.createOvertimeRequest({
      userId,
      date,
      startTime,
      endTime,
      reason,
      otTypeId,
    });

    // 2. Fetch Full Data (for socket payload)
    const fullRecord = await OvertimeService.getOvertimeById(newRequest.id);

    // 3. Emit Event
    emitOvertimeUpdate(req, "NEW_REQUEST", fullRecord);

    res.status(201).json({
      message: "Overtime request submitted",
      data: fullRecord,
    });
  } catch (error) {
    console.error("Create Overtime Error:", error);
    res.status(400).json({ message: error.message });
  }
};

// POST /api/overtime/create-admin (Admin Assign Overtime)
export const createAdminOvertimeRequest = async (req, res) => {
  try {
    const { targetUserId, date, startTime, endTime, reason, otTypeId } =
      req.body;

    if (
      !targetUserId ||
      !date ||
      !startTime ||
      !endTime ||
      !reason ||
      !otTypeId
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    // 1. Create Record
    const newRequest = await OvertimeService.createAdminOvertimeRequest({
      targetUserId,
      date,
      startTime,
      endTime,
      reason,
      otTypeId,
    });

    // 2. Fetch Full Data
    const fullRecord = await OvertimeService.getOvertimeById(newRequest.id);

    // 3. Emit Event (Notifies employee "Admin assigned OT")
    emitOvertimeUpdate(req, "ADMIN_ASSIGNED", fullRecord);

    res.status(201).json({
      message: "Overtime assigned successfully",
      data: fullRecord,
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

    const request = await OvertimeService.getOvertimeById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

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

    // 1. Delete
    await OvertimeService.deleteOvertime(id);

    // 2. Emit Event (Pass the request object so we know who to notify)
    emitOvertimeUpdate(req, "DELETE", request);

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
    const data = req.body;
    const roleId = req.user.role_id;
    const userId = req.user.userId;

    const request = await OvertimeService.getOvertimeById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    const isAdmin = roleId === 1 || roleId === 3;

    if (!isAdmin && request.user_id !== userId) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    if (!isAdmin && request.status !== "Pending") {
      return res
        .status(403)
        .json({ message: "You can only edit Pending requests." });
    }

    // 1. Update
    const updated = await OvertimeService.updateOvertime(id, data);

    // 2. Fetch Full Data
    const fullRecord = await OvertimeService.getOvertimeById(updated.id);

    // 3. Emit Event
    emitOvertimeUpdate(req, "UPDATE", fullRecord);

    res.status(200).json({ message: "Request updated", data: fullRecord });
  } catch (error) {
    console.error("Update Overtime Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/overtime/:id/status (Approve/Reject)
export const updateOvertimeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    // 1. Update Status
    await OvertimeService.updateOvertimeStatus(id, status, rejectionReason);

    // 2. Fetch Full Data
    const fullRecord = await OvertimeService.getOvertimeById(id);

    // 3. Emit Event (Notifies employee "Approved/Rejected")
    emitOvertimeUpdate(req, "STATUS_UPDATE", fullRecord);

    res.status(200).json({ message: `Request ${status}`, data: fullRecord });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
