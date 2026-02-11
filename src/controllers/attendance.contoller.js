import * as AttendanceService from "../services/attendance.service.js";

// ==========================================
// HELPER: CENTRALIZED SOCKET EMITTER
// ==========================================
// This handles sending updates to both the Admin Room and the User's Private Room
const emitUpdate = (req, type, fullRecord) => {
  const payload = { type, data: fullRecord };

  // 1. Notify Admins
  req.io.to("admin_room").emit("attendance_update", payload);

  // 2. Notify the Specific Employee
  // We check for user_id to ensure we target the correct private room
  if (fullRecord && fullRecord.user_id) {
    req.io.to(`user_${fullRecord.user_id}`).emit("attendance_update", payload);
  }
};

// ==========================================
// CONTROLLERS
// ==========================================

export const getAllAttendance = async (req, res) => {
  try {
    const records = await AttendanceService.getAllAttendance();
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getStatus = async (req, res) => {
  try {
    const userId = req.user.userId;
    const status = await AttendanceService.getTodayStatus(userId);
    res.status(200).json(status);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createManualEntry = async (req, res) => {
  try {
    const raw = await AttendanceService.createManualEntry(req.body);
    const full = await AttendanceService.getAttendanceById(raw.id);

    emitUpdate(req, "MANUAL_ENTRY", full);

    res
      .status(201)
      .json({ message: "Manual entry created successfully", data: full });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRecord = await AttendanceService.deleteAttendance(id);

    // We pass the deletedRecord so the helper knows which user_id to notify
    // The frontend will likely just use the 'id' to filter it out
    emitUpdate(req, "DELETE", deletedRecord);

    res
      .status(200)
      .json({ message: "Record deleted successfully", data: deletedRecord });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    await AttendanceService.updateAttendance(id, req.body);
    const full = await AttendanceService.getAttendanceById(id);

    emitUpdate(req, "UPDATE", full);

    res
      .status(200)
      .json({ message: "Record updated successfully", data: full });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;

    await AttendanceService.verifyAttendance(id, adminId, req.body);
    const full = await AttendanceService.getAttendanceById(id);

    emitUpdate(req, "UPDATE", full);

    res.status(200).json({
      message: `Time ${req.body.type.toUpperCase()} verified successfully`,
      data: full,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyWorkday = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;
    const { status } = req.body;

    await AttendanceService.verifyWorkday(id, adminId, status);
    const full = await AttendanceService.getAttendanceById(id);

    emitUpdate(req, "UPDATE", full);

    res
      .status(200)
      .json({ message: `Workday ${status} successfully`, data: full });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const clockIn = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { photo, location } = req.body;

    const rawRecord = await AttendanceService.clockIn(userId, photo, location);
    const fullRecord = await AttendanceService.getAttendanceById(rawRecord.id);

    emitUpdate(req, "TIME_IN", fullRecord);

    res.status(201).json({ message: "Clock In Successful", data: fullRecord });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const clockOut = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { photo, location } = req.body;

    const rawRecord = await AttendanceService.clockOut(userId, photo, location);
    const fullRecord = await AttendanceService.getAttendanceById(rawRecord.id);

    emitUpdate(req, "TIME_OUT", fullRecord);

    res.status(200).json({ message: "Clock Out Successful", data: fullRecord });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
