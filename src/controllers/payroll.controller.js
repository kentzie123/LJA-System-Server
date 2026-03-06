import PayrollService from "../services/payroll.service.js";

export const getAllPayRuns = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Check their exact database permission securely
    const canManage = await PayrollService.checkManagePermission(userId);
    
    // Service will automatically hide Drafts if canManage is false
    const runs = await PayrollService.getAllPayRuns(canManage);
    res.status(200).json(runs);
  } catch (error) {
    console.error("Get PayRuns Error:", error);
    res.status(500).json({ message: "Failed to fetch pay runs." });
  }
};

export const createPayRun = async (req, res) => {
  try {
    const { run_name, start_date, end_date, pay_date } = req.body;

    if (!start_date || !end_date || !pay_date) {
      return res.status(400).json({ message: "Missing required dates." });
    }

    const newPayRun = await PayrollService.createPayRun({ run_name, start_date, end_date, pay_date });
    res.status(201).json({ message: "Pay run created successfully as Draft", data: newPayRun });
  } catch (error) {
    console.error("Create PayRun Error:", error);
    res.status(500).json({ message: "Failed to create pay run." });
  }
};

export const approvePayRun = async (req, res) => {
  try {
    const { id } = req.params;
    await PayrollService.approvePayRun(id);
    res.status(200).json({ message: "Pay run approved successfully" });
  } catch (error) {
    console.error("Approve PayRun Error:", error);
    if (error.message === "Pay Run not found" || error.message === "Pay Run is already approved") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to approve pay run" });
  }
};

export const deletePayRun = async (req, res) => {
  try {
    const { id } = req.params;
    await PayrollService.deletePayRun(id);
    res.status(200).json({ message: "Pay run deleted successfully" });
  } catch (error) {
    console.error("Delete PayRun Error:", error);
    if (error.message === "Pay Run not found") {
      return res.status(404).json({ message: "Pay run not found" });
    }
    res.status(500).json({ message: "Failed to delete pay run" });
  }
};

export const getPayRunDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const canManage = await PayrollService.checkManagePermission(userId);
    const data = await PayrollService.getPayRunDetails(id, canManage);
    
    res.status(200).json(data);
  } catch (error) {
    console.error("Get PayRun Details Error:", error);
    if (error.message.includes("Unauthorized")) {
      return res.status(403).json({ message: error.message });
    }
    if (error.message === "Pay Run not found") {
      return res.status(404).json({ message: "Pay run not found" });
    }
    res.status(500).json({ message: "Failed to fetch details." });
  }
};

export const getAllRecords = async (req, res) => {
  try {
    const records = await PayrollService.getAllPayrollRecords();
    res.status(200).json(records);
  } catch (error) {
    console.error("Get All Records Error:", error);
    res.status(500).json({ message: "Failed to fetch payroll history." });
  }
};

export const getMyRecords = async (req, res) => {
  try {
    const userId = req.user.userId; 
    const records = await PayrollService.getUserPayrollRecords(userId);
    res.status(200).json(records);
  } catch (error) {
    console.error("Get My Records Error:", error);
    res.status(500).json({ message: "Failed to fetch your payslips." });
  }
};