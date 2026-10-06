const mongoose = require("mongoose");
const inviteSchema = new mongoose.Schema({
  code:{type:String,required:true,unique:true,index:true},
  deviceId:{type:mongoose.Schema.Types.ObjectId,ref:"Device",required:true},
  expiresAt:{type:Date,required:true,index:{expires:0}},
  createdAt:{type:Date,default:Date.now}
});
module.exports=mongoose.model("PairingInvite",inviteSchema);
