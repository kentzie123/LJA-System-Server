import * as userService from "../services/user.service.js";

export const fetchAllUsers = async (req, res) => {
  try {
    const allUsers = await userService.getAllUsers();
    res.status(200).json(allUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const createUser = async (req, res) => {
  try {
    const newUser = await userService.addUser(req.body);

    res.status(201).json({
      message: "User created successfully",
      user: newUser,
    });
  } catch (err) {
    if (err.message === "User already exists!") {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Server Error" });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    await userService.deleteUser(id);

    res.status(200).json({ message: "User deleted successfully" });
  } catch (err) {
    console.error(err);

    if (err.message === "User not found or already deleted") {
      return res.status(404).json({ error: err.message });
    }

    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedUser = await userService.editUser(id, req.body);

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    if (err.message === "User not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const uploadProfilePicture = async (req, res) => {
  try {
    const { userId: id } = req.user;
    const { image } = req.body; // Expecting the Base64 string here

    if (!image) {
      return res.status(400).json({ error: "No image data provided" });
    }

    // Call service to update the TEXT column with the Base64 string
    const updatedUser = await userService.updateProfilePicture(id, image);

    res.status(200).json({
      message: "Profile picture updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    if (err.message === "User not found") {
      return res.status(404).json({ error: err.message });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const updatePersonalProfile = async (req, res) => {
  try {
    const { userId: id } = req.user;
    

    const updatedUser = await userService.updateUserProfile(id, req.body);

    res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });
  } catch (err) {
    console.error(err);
    if (err.message === "User not found") {
      return res.status(404).json({ error: err.message });
    }
    // Handle unique email constraint error if they try to use an taken email
    if (err.code === "23505") {
      return res.status(400).json({ error: "Email already in use" });
    }
    res.status(500).json({ error: "Internal Server Error" });
  }
};
