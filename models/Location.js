const mongoose = require("mongoose");
const locationSchema = new mongoose.Schema({
  deviceId:{type:mongoose.Schema.Types.ObjectId,ref:"Device",required:true,index:true},
  latitude:{type:Number,required:true,min:-90,max:90},
  longitude:{type:Number,required:true,min:-180,max:180},
  accuracy:{type:Number,default:null,min:0},
  timestamp:{type:Date,default:Date.now,index:true}
});
locationSchema.index({deviceId:1,timestamp:-1});
module.exports=mongoose.model("Location",locationSchema);
