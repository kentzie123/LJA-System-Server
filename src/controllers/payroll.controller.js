import PayrollService from "../services/payroll.service.js";

export const getAllPayRuns = async (req, res) => {
  try {
    const payRuns = await PayrollService.getAllPayRuns();
    res.status(200).json(payRuns);
  } catch (error) {
    console.error("Get Pay Runs Error:", error);
    res.status(500).json({ message: "Failed to fetch pay runs." });
  }
};

export const getPayrollRecordsByRunId = async (req, res) => {
  try {
    const { id } = req.params;
    const records = await PayrollService.getRecordsByRunId(id);
    res.status(200).json(records);
  } catch (error) {
    console.error("Get Payroll Records Error:", error);
    res.status(500).json({ message: "Failed to fetch records." });
  }
};

export const createPayRun = async (req, res) => {
  try {
    // Expect dates from frontend (e.g., '2026-01-01')
    const { start_date, end_date, pay_date } = req.body;

    if (!start_date || !end_date || !pay_date) {
      return res.status(400).json({ message: "All dates are required." });
    }

    const payRunId = await PayrollService.createPayRun({ 
      start_date, 
      end_date, 
      pay_date 
    });

    res.status(201).json({ 
      message: "Pay run created successfully", 
      payRunId 
    });

  } catch (error) {
    console.error("Create Payroll Error:", error);
    res.status(500).json({ message: error.message || "Failed to process payroll." });
  }
};