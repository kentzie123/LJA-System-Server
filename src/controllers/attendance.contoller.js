import * as AttendanceService from "../services/attendance.service.js";

export const getAllAttendance = async (req, res) => {
  try {
    const records = await AttendanceService.getAllAttendance();
    res.status(200).json(records);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createManualEntry = async (req, res) => {
  try {
    const record = await AttendanceService.createManualEntry(req.body);
    res
      .status(201)
      .json({ message: "Manual entry created successfully", data: record });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const deleteAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRecord = await AttendanceService.deleteAttendance(id);
    res.status(200).json({
      message: "Record deleted successfully",
      data: deletedRecord,
    });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

export const updateAttendance = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRecord = await AttendanceService.updateAttendance(
      id,
      req.body
    );
    res.status(200).json({
      message: "Record updated successfully",
      data: updatedRecord,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const clockIn = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { photo, location } = req.body; // Receive location object

    const record = await AttendanceService.clockIn(userId, photo, location);
    res.status(201).json({ message: "Clock In Successful", data: record });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const clockOut = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { photo, location } = req.body; // Receive location object

    const record = await AttendanceService.clockOut(userId, photo, location);
    res.status(200).json({ message: "Clock Out Successful", data: record });
  } catch (error) {
    res.status(400).json({ message: error.message });
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

export const verifyAttendance = async (req, res) => {
  try {
    const { id } = req.params; // Attendance Record ID
    const adminId = req.user.userId; // Admin performing the action
    
    // Body expects: { type: "in", status: "Verified", notes: "Clear photo" }
    const record = await AttendanceService.verifyAttendance(id, adminId, req.body);
    
    res.status(200).json({ 
      message: `Time ${req.body.type.toUpperCase()} verified successfully`, 
      data: record 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

export const verifyWorkday = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;
    const { status } = req.body; // Expects { status: "Verified" } or "Rejected"

    const record = await AttendanceService.verifyWorkday(id, adminId, status);
    
    res.status(200).json({ 
      message: `Workday ${status} successfully`, 
      data: record 
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};