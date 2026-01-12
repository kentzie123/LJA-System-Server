import * as authService from "../services/auth.service.js";
import { generateToken } from "../utils/generateToken.js";

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authService.loginUser(email, password);

    generateToken(result, res);

    res.json({
      message: "Login successful",
      ...result,
    });
  } catch (err) {
    if (err.message === "Invalid Credentials") {
      return res.status(401).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const logout = (req, res) => {
  try {
    res.clearCookie("lja_hris_token", {
      httpOnly: true,
      secure: true, // true if using HTTPS
      sameSite: "None", // "None" if not same host change to "lax" for development
    });
    res.json("Logout successfully");
  } catch (err) {
    res.status(500).json({ error: "Server Error" });
  }
};

export const checkAuth = async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized - No user found" });
    }

    const user = await authService.getUserById(userId);

    res.status(200).json(user);
  } catch (err) {
    console.error("Error in checkAuth:", err.message);
    res.status(500).json({ error: "Server Error" });
  }
};
