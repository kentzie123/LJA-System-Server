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
// HELPER: VALIDATE BASE64 IMAGE FORMAT
// ==========================================
const isValidPhotoFormat = (base64String) => {
  // If there is no photo, it's valid (since photos are optional)
  if (!base64String) return true; 

  // List of allowed Base64 image headers
  const allowedFormats = [
    "data:image/jpeg", 
    "data:image/jpg", 
    "data:image/png", 
    "data:image/webp"
  ];

  // Returns true if the string starts with any of the allowed formats
  return allowedFormats.some(format => base64String.startsWith(format));
};

// ==========================================
// CONTROLLERS
// ==========================================

export const getAllAttendance = async (req, res) => {
  try {
    // 1. Extract the filters from the URL query string
    const { userId, startDate, endDate } = req.query;

    // 2. Pass them to the service we just wrote
    const attendances = await AttendanceService.getAllAttendance({
      userId,
      startDate,
      endDate
    });

    // 3. Send the filtered data back to the frontend
    res.status(200).json(attendances);
  } catch (error) {
    console.error("Error fetching attendances:", error);
    res.status(500).json({ message: "Failed to fetch attendances" });
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

export const adminClockOverride = async (req, res) => {
  try {
    const adminId = req.user.userId;
    const { targetUserId, type, date, overrideTime, photo, workSummary } = req.body;

    // 1. Validation for standard fields
    if (!targetUserId || !type || !date || !overrideTime) {
      return res.status(400).json({ message: "Missing required fields (targetUserId, type, date, overrideTime)." });
    }

    if (type === "out" && (!workSummary || workSummary.trim() === "")) {
      return res.status(400).json({ message: "Work summary is required for clocking out." });
    }

    // 2. Validation for Photo Format
    if (!isValidPhotoFormat(photo)) {
      return res.status(400).json({ 
        message: "Invalid photo format. Only JPG, PNG, and WebP images are supported." 
      });
    }

    // Call the service
    const rawRecord = await AttendanceService.adminClockOverride({
      adminId,
      targetUserId,
      type,
      date,
      overrideTime,
      photo,
      workSummary,
    });

    const fullRecord = await AttendanceService.getAttendanceById(rawRecord.id);

    // Emit Socket Update
    const emitType = type === "in" ? "TIME_IN" : "TIME_OUT";
    emitUpdate(req, emitType, fullRecord);

    res.status(200).json({ 
      message: `Admin Clock ${type.toUpperCase()} successful`, 
      data: fullRecord 
    });
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
    // 1. Extract workSummary from the request body
    const { photo, location, workSummary } = req.body;

    // 2. Backend Validation: Ensure workSummary is provided
    if (!workSummary || workSummary.trim() === "") {
      return res.status(400).json({ message: "Work summary is required to clock out." });
    }

    // 3. Pass workSummary into your service function
    const rawRecord = await AttendanceService.clockOut(userId, photo, location, workSummary);
    const fullRecord = await AttendanceService.getAttendanceById(rawRecord.id);

    emitUpdate(req, "TIME_OUT", fullRecord);

    res.status(200).json({ message: "Clock Out Successful", data: fullRecord });
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

export const getCalendarData = async (req, res) => {
  try {
    const { userId, year, month } = req.query;

    // Validate inputs
    if (!userId || !year || !month) {
      return res.status(400).json({ message: "userId, year, and month are required." });
    }

    // Call the service
    const data = await AttendanceService.getCalendarData(
      parseInt(userId), 
      parseInt(year), 
      parseInt(month) // Note: frontend sends 0-indexed month (0 = Jan, 1 = Feb, etc.)
    );

    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching calendar data:", error);
    res.status(500).json({ message: "Failed to fetch calendar data" });
  }
};