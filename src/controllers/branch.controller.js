import * as branchService from "../services/branch.service.js";

export const fetchBranches = async (req, res) => {
  try {
    const branches = await branchService.getAllBranches();
    res.status(200).json(branches);
  } catch (err) {
    console.error("Error fetching branches:", err);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
};
