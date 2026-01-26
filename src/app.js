// src/app.js
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { Server as SocketIO } from "socket.io";
import http from "http";

// Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import branchRoutes from "./routes/branch.routes.js";
import roleRoutes from "./routes/role.routes.js";
import attendanceRoutes from "./routes/attendance.routes.js";
import leaveRoutes from "./routes/leave.routes.js";
import overtimeRoutes from "./routes/overtime.routes.js";
import payrollRoutes from "./routes/payroll.routes.js";
import deductionRoutes from "./routes/deduction.routes.js";

export const app = express();
const server = http.createServer(app);

// Socket.IO configuration
const io = new SocketIO(server, {
  cors: {
    origin: true, // Allow any origin to connect
    credentials: true,
  },
});

// Express CORS configuration
app.use(
  cors({
    origin: true, // Allow any origin to connect (reflects the request origin)
    credentials: true,
  })
);

app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

// Route Middleware
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/attendances", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/deductions", deductionRoutes);

app.get("/api/status", (req, res) => {
  res.json({
    message: "HRIS API is running!",
    service: "Node.js Express",
    status: "ok",
  });
});

const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("A user connected", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId) userSocketMap[userId] = socket.id;
  console.log(userSocketMap);

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) {
      delete userSocketMap[userId];
    }
  });
});

export default server;