const Device = require("../models/Device");
const Location = require("../models/Location");
const {canAccessDevice}=require("./deviceController");

async function updateLocation(req,res,next){
  try{
    const {deviceId,latitude,longitude,accuracy,batteryLevel}=req.body;
    if(!deviceId||!Number.isFinite(Number(latitude))||!Number.isFinite(Number(longitude)))return res.status(400).json({message:"Invalid location data"});
    const device=await Device.findOne({_id:deviceId,userId:req.user._id}); if(!device)return res.status(403).json({message:"Only the device owner can upload its location"});
    const location=await Location.create({deviceId,latitude:Number(latitude),longitude:Number(longitude),accuracy:accuracy==null?null:Number(accuracy),timestamp:new Date()});
    device.status="ONLINE"; device.lastSeen=new Date(); if(Number.isFinite(Number(batteryLevel)))device.batteryLevel=Math.max(0,Math.min(100,Number(batteryLevel))); await device.save();
    req.app.get("io").to(`location:${deviceId}`).emit("location:update",{location});
    res.status(201).json({location});
  }catch(e){next(e);}
}
async function latest(req,res,next){try{const device=await Device.findById(req.params.deviceId);if(!device)return res.status(404).json({message:"Device not found"});if(!(await canAccessDevice(req.user._id,device._id)))return res.status(403).json({message:"Not authorized"});res.json({location:await Location.findOne({deviceId:device._id}).sort({timestamp:-1})});}catch(e){next(e);}}
async function history(req,res,next){try{const device=await Device.findById(req.params.deviceId);if(!device)return res.status(404).json({message:"Device not found"});if(!(await canAccessDevice(req.user._id,device._id)))return res.status(403).json({message:"Not authorized"});const limit=Math.min(Math.max(Number(req.query.limit)||100,1),500);res.json({locations:await Location.find({deviceId:device._id}).sort({timestamp:-1}).limit(limit)});}catch(e){next(e);}}
module.exports={updateLocation,latest,history};
