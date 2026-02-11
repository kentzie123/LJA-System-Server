import * as AllowanceService from "../services/allowance.service.js";

export const getAllAllowances = async (req, res) => {
  try {
    const allowances = await AllowanceService.getAllAllowances();
    res.status(200).json(allowances);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createAllowance = async (req, res) => {
  try {
    const allowance = await AllowanceService.createAllowance(req.body);
    res.status(201).json(allowance);
  } catch (error) {
    // Error Code '23505' is PostgreSQL for "Unique Violation"
    if (error.code === '23505') {
       return res.status(409).json({ message: "An allowance with this name already exists. Please choose a different name." });
    }
    
    // Log the real error for you (the developer) to see
    console.error("Create Allowance Error:", error);
    
    // Send a generic error to the user
    res.status(500).json({ message: "Failed to create allowance. Please try again." });
  }
};

export const deleteAllowance = async (req, res) => {
  try {
    await AllowanceService.deleteAllowance(req.params.id);
    res.status(200).json({ message: "Allowance deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getSubscribers = async (req, res) => {
  try {
    const subscribers = await AllowanceService.getSubscribers(req.params.id);
    res.status(200).json(subscribers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateSubscribers = async (req, res) => {
  try {
    // Expects { userIds: [1, 2, 3] }
    await AllowanceService.updateSubscribers(req.params.id, req.body.userIds);
    res.status(200).json({ message: "Subscribers updated" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const toggleStatus = async (req, res) => {
  try {
    const updatedAllowance = await AllowanceService.toggleAllowanceStatus(req.params.id);
    res.status(200).json(updatedAllowance);
  } catch (error) {
    console.error("Toggle Error:", error);
    res.status(500).json({ message: error.message });
  }
};