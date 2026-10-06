require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const connectDB = require("./config/db");

const authRoutes = require("./routes/authRoutes");
const deviceRoutes = require("./routes/deviceRoutes");
const pairingRoutes = require("./routes/pairingRoutes");
const locationRoutes = require("./routes/locationRoutes");
const commandRoutes = require("./routes/commandRoutes");

const setupSocket = require("./sockets/socketHandler");
const errorHandler = require("./middleware/errorHandler");
const Device = require("./models/Device");

async function main() {
    // --------------------------------------------------
    // Environment validation
    // --------------------------------------------------
    if (!process.env.MONGODB_URI || !process.env.JWT_SECRET) {
        throw new Error(
            "MONGODB_URI and JWT_SECRET are required in .env"
        );
    }

    // --------------------------------------------------
    // Connect to MongoDB
    // --------------------------------------------------
    await connectDB();

    // --------------------------------------------------
    // Express + HTTP server
    // --------------------------------------------------
    const app = express();
    const server = http.createServer(app);

    // --------------------------------------------------
    // Socket.IO
    // --------------------------------------------------
    const corsOrigin = process.env.CORS_ORIGIN || "*";

    const io = new Server(server, {
        cors: {
            origin: corsOrigin,
            methods: ["GET", "POST"],
        },
    });

    // Make Socket.IO available to controllers through req.app
    app.set("io", io);

    // --------------------------------------------------
    // Middleware
    // --------------------------------------------------
    app.use(
        cors({
            origin: corsOrigin,
            methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        })
    );

    app.use(express.json({ limit: "1mb" }));

    // --------------------------------------------------
    // Health check
    // --------------------------------------------------
    app.get("/api/health", (req, res) => {
        res.json({
            status: "ok",
            service: "DeviceGuard",
        });
    });

    // --------------------------------------------------
    // API routes
    // --------------------------------------------------
    app.use("/api/auth", authRoutes);
    app.use("/api/devices", deviceRoutes);
    app.use("/api/pairing", pairingRoutes);
    app.use("/api/location", locationRoutes);
    app.use("/api/commands", commandRoutes);

    // --------------------------------------------------
    // Error handler
    // --------------------------------------------------
    app.use(errorHandler);

    // --------------------------------------------------
    // Socket.IO event handling
    // --------------------------------------------------
    setupSocket(io);

    // --------------------------------------------------
    // Start server
    // --------------------------------------------------
    const port = Number(process.env.PORT || 5000);

    server.listen(port, "0.0.0.0", () => {
        console.log(`DeviceGuard server running on port ${port}`);
    });

    // --------------------------------------------------
    // Offline-device cleanup
    //
    // A device is considered offline if it has not sent
    // a heartbeat for more than 2 minutes.
    // --------------------------------------------------
    setInterval(async () => {
        try {
            const cutoff = new Date(Date.now() - 2 * 60 * 1000);

            const staleDevices = await Device.find({
                lastSeen: { $lt: cutoff },
                status: "ONLINE",
            }).select("_id");

            if (staleDevices.length === 0) {
                return;
            }

            const staleIds = staleDevices.map((device) => device._id);

            await Device.updateMany(
                {
                    _id: { $in: staleIds },
                },
                {
                    $set: {
                        status: "OFFLINE",
                    },
                }
            );

            // Notify clients that are subscribed to these devices.
            for (const device of staleDevices) {
                io.to(`device:${device._id}`).emit("device:offline", {
                    deviceId: device._id,
                });
            }
        } catch (error) {
            console.error("Offline cleanup error:", error.message);
        }
    }, 60 * 1000);
}

// --------------------------------------------------
// Start application
// --------------------------------------------------
main().catch((error) => {
    console.error("Failed to start DeviceGuard:", error);
    process.exit(1);
});