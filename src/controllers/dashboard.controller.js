import DashboardService from "../services/dashboard.service.js";

export const getAdminDashboard = async (req, res) => {
  try {
    const stats = await DashboardService.getAdminStats();
    res.status(200).json(stats);
  } catch (error) {
    console.error("Admin Dashboard Error:", error);
    res.status(500).json({ message: "Failed to load dashboard stats." });
  }
};

export const getEmployeeDashboard = async (req, res) => {
  try {
    // req.user.userId comes from your verifyToken middleware
    const stats = await DashboardService.getEmployeeStats(req.user.userId);
    res.status(200).json(stats);
  } catch (error) {
    console.error("Employee Dashboard Error:", error);
    res.status(500).json({ message: "Failed to load personal stats." });
  }
};