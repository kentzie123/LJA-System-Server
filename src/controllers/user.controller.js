import * as userService from "../services/user.service.js"; // Ensure this matches your file path

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
