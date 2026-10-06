const crypto = require("crypto");
const Device = require("../models/Device");
const Pairing = require("../models/Pairing");
const PairingInvite = require("../models/PairingInvite");
const Location = require("../models/Location");

async function ownedDevice(userId,deviceId){return Device.findOne({_id:deviceId,userId});}

async function createDevice(req,res,next){
  try{
    const deviceName=String(req.body.deviceName||"").trim(); const deviceIdentifier=String(req.body.deviceIdentifier||"").trim();
    if(!deviceName||!deviceIdentifier)return res.status(400).json({message:"Device name and identifier are required"});
    const existing=await Device.findOne({deviceIdentifier});
    if(existing && existing.userId.toString()!==req.user._id.toString())return res.status(409).json({message:"Device identifier is already registered to another account"});
    if(existing)return res.json({device:existing});
    const device=await Device.create({userId:req.user._id,deviceName,deviceIdentifier,deviceType:"PHONE"});
    res.status(201).json({device});
  }catch(e){next(e);}
}

async function listDevices(req,res,next){try{res.json({devices:await Device.find({userId:req.user._id}).sort({createdAt:-1})});}catch(e){next(e);}}

async function getDevice(req,res,next){
  try{const device=await Device.findById(req.params.id); if(!device)return res.status(404).json({message:"Device not found"}); if(!(await canAccessDevice(req.user._id,device._id)))return res.status(403).json({message:"Not authorized"}); res.json({device});}
  catch(e){next(e);}
}

async function heartbeat(req,res,next){
  try{
    const device=await ownedDevice(req.user._id,req.body.deviceId); if(!device)return res.status(403).json({message:"Not authorized"});
    device.status="ONLINE"; device.lastSeen=new Date();
    if(Number.isFinite(Number(req.body.batteryLevel)))device.batteryLevel=Math.max(0,Math.min(100,Number(req.body.batteryLevel)));
    await device.save(); req.app.get("io").to(`device:${device._id}`).emit("device:online",{device}); res.json({device});
  }catch(e){next(e);}
}

async function deleteDevice(req,res,next){
  try{
    const device=await ownedDevice(req.user._id,req.params.id); if(!device)return res.status(404).json({message:"Device not found"});
    await PairingInvite.deleteMany({deviceId:device._id}); await Pairing.deleteMany({$or:[{controllerDeviceId:device._id},{trackedDeviceId:device._id}]}); await Location.deleteMany({deviceId:device._id}); await device.deleteOne(); res.json({message:"Device deleted"});
  }catch(e){next(e);}
}

async function canAccessDevice(userId,deviceId){
  const ownedIds=await Device.find({userId}).distinct("_id");
  if(ownedIds.some(id=>id.toString()===deviceId.toString()))return true;
  const pairing=await Pairing.findOne({status:"ACTIVE",$or:[{controllerDeviceId:{$in:ownedIds},trackedDeviceId:deviceId},{trackedDeviceId:{$in:ownedIds},controllerDeviceId:deviceId}]});
  return !!pairing;
}

async function makePairingCode(req,res,next){
  try{
    const device=await ownedDevice(req.user._id,req.body.deviceId); if(!device)return res.status(404).json({message:"Owned device not found"});
    const code=String(crypto.randomInt(100000,1000000)); const expiresAt=new Date(Date.now()+10*60*1000);
    await PairingInvite.deleteMany({deviceId:device._id}); await PairingInvite.create({code,deviceId:device._id,expiresAt});
    res.json({code,expiresInSeconds:600});
  }catch(e){next(e);}
}

async function joinPairing(req,res,next){
  try{
    const own=await ownedDevice(req.user._id,req.body.deviceId); if(!own)return res.status(404).json({message:"Your device was not found"});
    const code=String(req.body.code||"").trim(); const invite=await PairingInvite.findOne({code}).populate("deviceId");
    if(!invite||invite.expiresAt.getTime()<Date.now())return res.status(400).json({message:"Invalid or expired pairing code"});
    const target=invite.deviceId; if(target._id.toString()===own._id.toString())return res.status(400).json({message:"Cannot pair a device with itself"});
    let pairing=await Pairing.findOne({status:"ACTIVE",$or:[{controllerDeviceId:own._id,trackedDeviceId:target._id},{controllerDeviceId:target._id,trackedDeviceId:own._id}]});
    if(!pairing){pairing=await Pairing.create({controllerDeviceId:own._id,trackedDeviceId:target._id});}
    await PairingInvite.deleteOne({_id:invite._id});
    const io=req.app.get("io"); io.to(`device:${own._id}`).emit("pairing:accepted",{pairing}); io.to(`device:${target._id}`).emit("pairing:accepted",{pairing});
    const populated=await Pairing.findById(pairing._id).populate("controllerDeviceId trackedDeviceId");
    res.status(201).json({pairing:populated});
  }catch(e){next(e);}
}

async function listPaired(req,res,next){
  try{
    const owned=await Device.find({userId:req.user._id}).distinct("_id");
    const pairings=await Pairing.find({status:"ACTIVE",$or:[{controllerDeviceId:{$in:owned}},{trackedDeviceId:{$in:owned}}]}).populate("controllerDeviceId trackedDeviceId").sort({createdAt:-1});
    res.json({pairings});
  }catch(e){next(e);}
}

module.exports={createDevice,listDevices,getDevice,heartbeat,deleteDevice,makePairingCode,joinPairing,listPaired,canAccessDevice};
