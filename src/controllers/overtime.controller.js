import * as OvertimeService from "../services/overtime.service.js";

// ==========================================
// HELPER: ROLE CHECK
// ==========================================
const isAdminRole = (roleId) => roleId === 1 || roleId === 3;

// ==========================================
// HELPER: CENTRALIZED OVERTIME SOCKET EMITTER
// ==========================================
const emitOvertimeUpdate = (req, type, otData) => {
  if (!req?.io) return;

  const payload = { type, data: otData };

  // Notify admins
  req.io.to("admin_room").emit("overtime_update", payload);

  // Notify specific employee
  if (otData?.user_id) {
    req.io.to(`user_${otData.user_id}`).emit("overtime_update", payload);
  }
};

// ==========================================
// READ / VIEW ONLY
// ==========================================

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
    const { userId, role_id } = req.user;

    const {
      status,
      month,
      year,
      targetUserId,
      startDate,
      endDate,
    } = req.query;

    const records = await OvertimeService.getAllOvertime(userId, role_id, {
      status,
      month,
      year,
      targetUserId,
      startDate,
      endDate,
    });

    res.status(200).json(records);
  } catch (error) {
    console.error("Fetch Overtime Error:", error);
    res.status(500).json({ message: "Failed to fetch overtime records." });
  }
};

export const getOvertimeStats = async (req, res) => {
  try {
    const { userId, role_id } = req.user;
    const { month, year } = req.query;

    const stats = await OvertimeService.getOvertimeStats(userId, role_id, {
      month,
      year,
    });

    res.status(200).json(stats);
  } catch (error) {
    console.error("Fetch Stats Error:", error);
    res.status(500).json({ message: "Failed to fetch statistics" });
  }
};

// ==========================================
// CREATE REQUEST (EMPLOYEE)
// ==========================================

export const createOvertimeRequest = async (req, res) => {
  try {
    const { startAt, endAt, reason, otTypeId } = req.body;
    const userId = req.user.userId;

    if (!startAt || !endAt || !reason || !otTypeId) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newRequest = await OvertimeService.createOvertimeRequest({
      userId,
      startAt,
      endAt,
      reason,
      otTypeId,
    });

    const fullRecord = await OvertimeService.getOvertimeById(newRequest.id);

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

// ==========================================
// CREATE REQUEST (ADMIN ASSIGN)
// ==========================================

export const createAdminOvertimeRequest = async (req, res) => {
  try {
    const { targetUserId, startAt, endAt, reason, otTypeId } = req.body;

    if (!targetUserId || !startAt || !endAt || !reason || !otTypeId) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const newRequest = await OvertimeService.createAdminOvertimeRequest({
      targetUserId,
      startAt,
      endAt,
      reason,
      otTypeId,
    });

    const fullRecord = await OvertimeService.getOvertimeById(newRequest.id);

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

// ==========================================
// DELETE REQUEST
// ==========================================

export const deleteOvertimeRequest = async (req, res) => {;
  
  try {
    const { id } = req.params;
    const { role_id, userId } = req.user;

    const request = await OvertimeService.getOvertimeById(id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const isAdmin = isAdminRole(role_id);
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

    emitOvertimeUpdate(req, "DELETE", request);

    res.status(200).json({ message: "Request deleted successfully" });
  } catch (error) {
    console.error("Delete Overtime Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// UPDATE REQUEST DETAILS
// ==========================================

export const updateOvertimeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const { role_id, userId } = req.user;

    const request = await OvertimeService.getOvertimeById(id);

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const isAdmin = isAdminRole(role_id);

    if (!isAdmin && request.user_id !== userId) {
      return res.status(403).json({ message: "Unauthorized action." });
    }

    if (!isAdmin && request.status !== "Pending") {
      return res
        .status(403)
        .json({ message: "You can only edit Pending requests." });
    }

    const updated = await OvertimeService.updateOvertime(id, data);

    const fullRecord = await OvertimeService.getOvertimeById(updated.id);

    emitOvertimeUpdate(req, "UPDATE", fullRecord);

    res.status(200).json({
      message: "Request updated",
      data: fullRecord,
    });
  } catch (error) {
    console.error("Update Overtime Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// ==========================================
// APPROVE / REJECT REQUEST
// ==========================================

export const updateOvertimeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, rejectionReason } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status is required." });
    }

    await OvertimeService.updateOvertimeStatus(id, status, rejectionReason);

    const fullRecord = await OvertimeService.getOvertimeById(id);

    emitOvertimeUpdate(req, "STATUS_UPDATE", fullRecord);

    res.status(200).json({
      message: `Request ${status}`,
      data: fullRecord,
    });
  } catch (error) {
    console.error("Update Status Error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};