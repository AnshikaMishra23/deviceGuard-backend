const mongoose = require("mongoose");
const deviceSchema = new mongoose.Schema({
  userId:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  deviceName:{type:String,required:true,trim:true,minlength:1,maxlength:80},
  deviceType:{type:String,default:"PHONE"},
  deviceIdentifier:{type:String,required:true,unique:true},
  status:{type:String,enum:["ONLINE","OFFLINE"],default:"OFFLINE"},
  batteryLevel:{type:Number,min:-1,max:100,default:-1},
  lastSeen:{type:Date,default:null},
  createdAt:{type:Date,default:Date.now}
});
module.exports=mongoose.model("Device",deviceSchema);
