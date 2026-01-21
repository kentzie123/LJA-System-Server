import PayrollService from "../services/payroll.service.js";

export const createPayRun = async (req, res) => {
  try {
    const { run_name, start_date, end_date, pay_date } = req.body;

    if (!start_date || !end_date || !pay_date) {
      return res.status(400).json({ message: "Missing required dates." });
    }

    const newPayRun = await PayrollService.createPayRun({
      run_name,
      start_date,
      end_date,
      pay_date,
    });

    res.status(201).json({
      message: "Pay run created successfully",
      data: newPayRun,
    });
  } catch (error) {
    console.error("Create PayRun Error:", error);
    res.status(500).json({ message: "Failed to create pay run." });
  }
};

export const getAllPayRuns = async (req, res) => {
  try {
    const runs = await PayrollService.getAllPayRuns();
    res.status(200).json(runs);
  } catch (error) {
    console.error("Get PayRuns Error:", error);
    res.status(500).json({ message: "Failed to fetch pay runs." });
  }
};

export const deletePayrun = async (req, res) => {
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
