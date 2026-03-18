import * as userService from "../services/user.service.js";

// 1. Fetch All Users
export const fetchAllUsers = async (req, res) => {
  try {
    const allUsers = await userService.getAllUsers();
    res.status(200).json(allUsers);
  } catch (err) {
    console.error("Error fetching all users:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

// 2. Create User (Admin Action)
export const createUser = async (req, res) => {
  try {
    // The service now handles swapping daily_rate/payrate based on pay_type
    const newUser = await userService.addUser(req.body);

    res.status(201).json({
      message: "User created successfully",
      user: newUser,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    if (err.message === "User already exists!" || err.code === "23505") {
      return res.status(400).json({ error: "User with this email already exists" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 3. Delete User
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await userService.deleteUser(id);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("Error deleting user:", err);
    if (err.message === "User not found or already deleted") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 4. Update User (Admin Action)
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    // The service now handles swapping daily_rate/payrate based on pay_type
    const updatedUser = await userService.editUser(id, req.body);

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    if (err.message === "User not found") {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email is already taken by another user" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 5. Upload Profile Picture (Self Action)
export const uploadProfilePicture = async (req, res) => {
  try {
    const id = req.user?.userId; // Ensure middleware populated req.user
    const { image } = req.body; 

    if (!id) {
      return res.status(401).json({ error: "Unauthorized: User ID missing" });
    }
    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    const updatedUser = await userService.updateProfilePicture(id, image);

    res.status(200).json({
      message: "Profile picture updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error uploading profile picture:", err);
    if (err.message === "User not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 6. Update Personal Profile (Self-Update)
export const updatePersonalProfile = async (req, res) => {
  try {
    const id = req.user?.userId;
    
    if (!id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const updatedUser = await userService.updateUserProfile(id, req.body);

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error("Error updating personal profile:", err);
    if (err.message === "User not found") {
      return res.status(404).json({ error: err.message });
    }
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already in use" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// 7. Fetch Single User by employee_id
export const fetchUserByEmployeeId = async (req, res) => {
  try {
    const { id } = req.params; // This 'id' is actually the employee_id string (e.g., '2025-001')
    const user = await userService.getUserByEmployeeId(id);
    res.status(200).json(user);
  } catch (err) {
    console.error("Error fetching user by employee ID:", err);
    if (err.message === "User not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
};