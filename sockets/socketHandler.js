// const jwt=require("jsonwebtoken");
// const User=require("../models/User");
// const Device=require("../models/Device");
// const {canAccessDevice}=require("../controllers/deviceController");

// function setupSocket(io){
//  io.use(async(socket,next)=>{
//   try{
//    const token=socket.handshake.auth?.token;
//    if(!token)return next(new Error("Authentication required"));
//    const decoded=jwt.verify(token,process.env.JWT_SECRET);
//    const user=await User.findById(decoded.userId);
//    if(!user)return next(new Error("User not found"));

//    const requestedDeviceId=socket.handshake.auth?.deviceId;
//    if(requestedDeviceId){
//     const device=await Device.findOne({_id:requestedDeviceId,userId:user._id}).select("_id");
//     if(!device)return next(new Error("Device is not owned by this account"));
//     socket.deviceId=device._id.toString();
//    }

//    socket.user=user;
//    next();
//   }catch(e){next(new Error("Invalid token"));}
//  });

//  io.on("connection",async socket=>{
//   // IMPORTANT: command room is private to the actual connected device.
//   // We no longer join every device owned by the same user.
//   if(socket.deviceId){
//    socket.join(`device:${socket.deviceId}`);
//   }

//   socket.on("identifyDevice",async deviceId=>{
//    try{
//     const device=await Device.findOne({_id:deviceId,userId:socket.user._id}).select("_id");
//     if(!device)return;
//     if(socket.deviceId && socket.deviceId!==deviceId){
//      socket.leave(`device:${socket.deviceId}`);
//     }
//     socket.deviceId=deviceId;
//     socket.join(`device:${deviceId}`);
//    }catch(e){console.error("identify device",e.message);}
//   });

//   // Subscription is ONLY for location updates. It never joins the command room.
//   socket.on("subscribeDevice",async deviceId=>{
//    try{
//     if(await canAccessDevice(socket.user._id,deviceId)){
//      socket.join(`location:${deviceId}`);
//     }
//    }catch(e){console.error("subscribe",e.message);}
//   });

//   socket.on("unsubscribeDevice",deviceId=>{
//    if(typeof deviceId === "string" && deviceId){
//     socket.leave(`location:${deviceId}`);
//    }
//   });
//  });
// }

// module.exports=setupSocket;


const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Device = require("../models/Device");
const { canAccessDevice } = require("../controllers/deviceController");

function setupSocket(io) {
    // --------------------------------------------------
    // Socket.IO authentication middleware
    // --------------------------------------------------
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token;

            if (!token) {
                return next(new Error("Authentication required"));
            }

            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET
            );

            const user = await User.findById(decoded.userId);

            if (!user) {
                return next(new Error("User not found"));
            }

            socket.user = user;

            // --------------------------------------------------
            // Identify the actual device making this connection.
            // Only devices owned by the authenticated user are allowed.
            // --------------------------------------------------
            const requestedDeviceId =
                socket.handshake.auth?.deviceId;

            if (requestedDeviceId) {
                const device = await Device.findOne({
                    _id: requestedDeviceId,
                    userId: user._id
                }).select("_id");

                if (!device) {
                    return next(
                        new Error("Device is not owned by this account")
                    );
                }

                socket.deviceId = device._id.toString();
            }

            next();
        } catch (error) {
            console.error("Socket authentication error:", error.message);
            next(new Error("Invalid token"));
        }
    });

    // --------------------------------------------------
    // Socket connection
    // --------------------------------------------------
    io.on("connection", (socket) => {
        // --------------------------------------------------
        // COMMAND ROOM
        //
        // Only the actual connected device joins its own
        // device room.
        //
        // Example:
        // Phone B → device:PHONE_B_ID
        //
        // Therefore:
        // Phone A → Ring Phone B
        //          → only device:PHONE_B_ID receives it
        // --------------------------------------------------
        if (socket.deviceId) {
            socket.join(`device:${socket.deviceId}`);
        }

        // --------------------------------------------------
        // identifyDevice
        //
        // Used when the Android client identifies itself
        // after establishing the Socket.IO connection.
        // --------------------------------------------------
        socket.on("identifyDevice", async (deviceId) => {
            try {
                if (!deviceId) {
                    return;
                }

                const normalizedDeviceId = String(deviceId);

                const device = await Device.findOne({
                    _id: normalizedDeviceId,
                    userId: socket.user._id
                }).select("_id");

                if (!device) {
                    return;
                }

                // Leave previous command room if one exists.
                if (
                    socket.deviceId &&
                    socket.deviceId !== normalizedDeviceId
                ) {
                    socket.leave(`device:${socket.deviceId}`);
                }

                // Join only this device's command room.
                socket.deviceId = normalizedDeviceId;

                socket.join(`device:${normalizedDeviceId}`);
            } catch (error) {
                console.error(
                    "identifyDevice error:",
                    error.message
                );
            }
        });

        // --------------------------------------------------
        // LOCATION SUBSCRIPTION
        //
        // This is deliberately separate from the command room.
        // A controller can subscribe to another authorized
        // device's location without receiving its commands.
        // --------------------------------------------------
        socket.on("subscribeDevice", async (deviceId) => {
            try {
                if (!deviceId) {
                    return;
                }

                const normalizedDeviceId = String(deviceId);

                const allowed = await canAccessDevice(
                    socket.user._id,
                    normalizedDeviceId
                );

                if (!allowed) {
                    return;
                }

                socket.join(
                    `location:${normalizedDeviceId}`
                );
            } catch (error) {
                console.error(
                    "subscribeDevice error:",
                    error.message
                );
            }
        });

        // --------------------------------------------------
        // LOCATION UNSUBSCRIPTION
        // --------------------------------------------------
        socket.on("unsubscribeDevice", (deviceId) => {
            if (!deviceId) {
                return;
            }

            socket.leave(`location:${String(deviceId)}`);
        });

        // --------------------------------------------------
        // Disconnect
        //
        // Socket.IO automatically removes the socket from
        // all rooms. No manual cleanup is necessary here.
        // --------------------------------------------------
        socket.on("disconnect", (reason) => {
            console.log(
                `Socket disconnected: ${socket.id} (${reason})`
            );
        });
    });
}

module.exports = setupSocket;