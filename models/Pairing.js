const mongoose = require("mongoose");
const pairingSchema = new mongoose.Schema({
  controllerDeviceId:{type:mongoose.Schema.Types.ObjectId,ref:"Device",required:true},
  trackedDeviceId:{type:mongoose.Schema.Types.ObjectId,ref:"Device",required:true},
  status:{type:String,enum:["ACTIVE"],default:"ACTIVE"},
  createdAt:{type:Date,default:Date.now}
});
pairingSchema.index({controllerDeviceId:1,trackedDeviceId:1},{unique:true});
module.exports=mongoose.model("Pairing",pairingSchema);
