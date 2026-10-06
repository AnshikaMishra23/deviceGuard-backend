const Device=require("../models/Device");
const Pairing=require("../models/Pairing");

async function ring(req,res,next){
 try{
  const targetDeviceId=req.body.deviceId;
  const requesterDeviceId=req.body.requesterDeviceId;

  if(!targetDeviceId||!requesterDeviceId){
   return res.status(400).json({message:"deviceId and requesterDeviceId are required"});
  }

  // The requesting device must belong to the authenticated user.
  const requester=await Device.findOne({_id:requesterDeviceId,userId:req.user._id}).select("_id");
  if(!requester){
   return res.status(403).json({message:"Requesting device is not authorized"});
  }

  if(targetDeviceId===requesterDeviceId){
   return res.status(400).json({message:"Cannot ring the requesting device"});
  }

  // Require this exact pair, rather than any pairing belonging to the user.
  const pairing=await Pairing.findOne({
   status:"ACTIVE",
   $or:[
    {controllerDeviceId:requesterDeviceId,trackedDeviceId:targetDeviceId},
    {controllerDeviceId:targetDeviceId,trackedDeviceId:requesterDeviceId}
   ]
  });

  if(!pairing){
   return res.status(403).json({message:"Device is not paired with this phone"});
  }

  req.app.get("io").to(`device:${targetDeviceId}`).emit("device:ring",{
   targetDeviceId,
   requestedByDeviceId:requesterDeviceId,
   requestedAt:new Date().toISOString(),
   durationMs:30000
  });

  res.json({message:"Ring command sent"});
 }catch(e){next(e);}
}

module.exports={ring};
