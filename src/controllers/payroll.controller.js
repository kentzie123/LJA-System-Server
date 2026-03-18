import PayrollService from "../services/payroll.service.js";

// 1. GET ALL PAY RUNS (Filtered by permission)
export const getAllPayRuns = async (req, res) => {
  try {
    const userId = req.user.userId;
    // Check if user has permission to see Drafts
    const canManage = await PayrollService.checkManagePermission(userId);
    
    // Service returns all if canManage is true, only Approved if false
    const runs = await PayrollService.getAllPayRuns(canManage);
    res.status(200).json(runs);
  } catch (error) {
    console.error("Get PayRuns Error:", error);
    res.status(500).json({ message: "Failed to fetch pay runs." });
  }
};

// 2. CREATE NEW PAY RUN (Draft)
export const createPayRun = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { run_name, start_date, end_date, pay_date } = req.body;

    // Security Check
    const canManage = await PayrollService.checkManagePermission(userId);
    if (!canManage) {
      return res.status(403).json({ message: "Forbidden: You do not have permission to create pay runs." });
    }

    if (!start_date || !end_date || !pay_date) {
      return res.status(400).json({ message: "Missing required dates." });
    }

    const newPayRun = await PayrollService.createPayRun({ run_name, start_date, end_date, pay_date });
    res.status(201).json({ message: "Pay run generated successfully as Draft", data: newPayRun });
  } catch (error) {
    console.error("Create PayRun Error:", error);
    res.status(500).json({ message: "Failed to create pay run." });
  }
};

// 3. APPROVE PAY RUN (Finalize and Move to Ledger)
export const approvePayRun = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Security Check
    const canManage = await PayrollService.checkManagePermission(userId);
    if (!canManage) {
      return res.status(403).json({ message: "Forbidden: You do not have permission to approve payroll." });
    }

    await PayrollService.approvePayRun(id);
    res.status(200).json({ message: "Pay run approved and ledger updated successfully" });
  } catch (error) {
    console.error("Approve PayRun Error:", error);
    if (error.message === "Pay Run not found" || error.message === "Pay Run is already approved") {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to approve pay run" });
  }
};

// 4. DELETE PAY RUN
export const deletePayRun = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    // Security Check
    const canManage = await PayrollService.checkManagePermission(userId);
    if (!canManage) {
      return res.status(403).json({ message: "Forbidden: You do not have permission to delete pay runs." });
    }

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

// 5. GET PAY RUN DETAILS (Records of everyone in that run)
export const getPayRunDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const canManage = await PayrollService.checkManagePermission(userId);
    console.log(canManage);
    
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

// 6. GET ALL RECORDS (History across all approved runs)
export const getAllRecords = async (req, res) => {
  try {
    const userId = req.user.userId;
    const canManage = await PayrollService.checkManagePermission(userId);
    
    if (!canManage) {
      return res.status(403).json({ message: "Forbidden: Unauthorized access to all records." });
    }

    const records = await PayrollService.getAllPayrollRecords();
    res.status(200).json(records);
  } catch (error) {
    console.error("Get All Records Error:", error);
    res.status(500).json({ message: "Failed to fetch payroll history." });
  }
};

// 7. GET MY RECORDS (Personal Payslips only)
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