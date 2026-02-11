import DeductionService from "../services/deduction.service.js";

// 1. CREATE PLAN
export const createDeduction = async (req, res) => {
  try {
    const newPlan = await DeductionService.createDeduction(req.body);
    res.status(201).json({
      message: "Deduction plan created successfully",
      data: newPlan,
    });
  } catch (error) {
    console.error("Create Deduction Error:", error);
    if (error.message.includes("Percentage must be between")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Failed to create deduction plan." });
  }
};

// 2. GET ALL PLANS
export const getAllPlans = async (req, res) => {
  try {
    const plans = await DeductionService.getAllPlans();
    res.status(200).json(plans);
  } catch (error) {
    console.error("Get All Plans Error:", error);
    res.status(500).json({ message: "Failed to fetch plans." });
  }
};

// 3. UPDATE PLAN (Edit Name/Amount)
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPlan = await DeductionService.updatePlan(id, req.body);
    res.status(200).json({
      message: "Plan updated successfully",
      data: updatedPlan,
    });
  } catch (error) {
    console.error("Update Plan Error:", error);
    res.status(500).json({ message: "Failed to update plan." });
  }
};

// 4. DELETE PLAN
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;
    await DeductionService.deletePlan(id);
    res.status(200).json({ message: "Plan deleted successfully." });
  } catch (error) {
    console.error("Delete Plan Error:", error);
    res.status(500).json({ message: "Failed to delete plan." });
  }
};

// 5. MANAGE SUBSCRIBERS
export const updateSubscribers = async (req, res) => {
  try {
    const { id } = req.params;
    const { user_ids } = req.body;
    const result = await DeductionService.updateSubscribers(id, user_ids);
    res.status(200).json({
      message: "Subscribers updated successfully.",
      count: result.count,
    });
  } catch (error) {
    console.error("Update Subscribers Error:", error);
    res.status(500).json({ message: "Failed to update subscribers." });
  }
};

// 6. TOGGLE STATUS (PAUSE/RESUME) -- ADDED THIS
export const toggleStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedPlan = await DeductionService.toggleStatus(id);
    res.status(200).json(updatedPlan);
  } catch (error) {
    console.error("Toggle Status Error:", error);
    res.status(500).json({ message: "Failed to update status." });
  }
};