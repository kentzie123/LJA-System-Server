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
import dashboardRoutes from "./routes/dashboard.routes.js";
import allowanceRoutes from "./routes/allowance.routes.js";

const allowedOrigins = ["http://localhost:3000"];

export const app = express();
const server = http.createServer(app);
const io = new SocketIO(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

// --- 1. MIDDLEWARE TO INJECT IO ---
app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: "50mb" }));
app.use(cookieParser());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/branches", branchRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/attendances", attendanceRoutes);
app.use("/api/leave", leaveRoutes);
app.use("/api/overtime", overtimeRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/deductions", deductionRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/allowance", allowanceRoutes);

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

  // --- 2. JOIN ROOM LOGIC ---
  const { userId, roleId } = socket.handshake.query;

  if (userId) {
    userSocketMap[userId] = socket.id;

    // [NEW] JOIN PERSONAL ROOM
    // This allows us to do: req.io.to("user_15").emit(...)
    socket.join(`user_${userId}`);
    console.log(`User ${userId} joined room: user_${userId}`);
  }

  // Admin Room Logic (System Admin=1, Super Admin=3)
  if (roleId === "1" || roleId === "3") {
    socket.join("admin_room");
    console.log(`User ${userId} (Role ${roleId}) joined admin_room`);
  }

  socket.on("disconnect", () => {
    console.log("A user disconnected", socket.id);
    if (userId) delete userSocketMap[userId];
  });
});

export default server;
