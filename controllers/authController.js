const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");

function tokenFor(user){return jwt.sign({userId:user._id.toString()},process.env.JWT_SECRET,{expiresIn:"7d"});}

async function register(req,res,next){
  try{
    const errors=validationResult(req); if(!errors.isEmpty()) return res.status(400).json({message:errors.array()[0].msg});
    const {name,email,password}=req.body; const normalized=email.toLowerCase().trim();
    const existing=await User.findOne({email:normalized}); if(existing)return res.status(409).json({message:"Email already registered"});
    const passwordHash=await bcrypt.hash(password,12); const user=await User.create({name,email:normalized,passwordHash});
    res.status(201).json({token:tokenFor(user),user:{id:user._id.toString(),name:user.name,email:user.email}});
  }catch(e){next(e);}
}
async function login(req,res,next){
  try{
    const errors=validationResult(req); if(!errors.isEmpty()) return res.status(400).json({message:errors.array()[0].msg});
    const {email,password}=req.body; const user=await User.findOne({email:email.toLowerCase().trim()});
    if(!user||!(await bcrypt.compare(password,user.passwordHash))) return res.status(401).json({message:"Invalid email or password"});
    res.json({token:tokenFor(user),user:{id:user._id.toString(),name:user.name,email:user.email}});
  }catch(e){next(e);}
}
async function me(req,res){res.json({user:req.user});}
module.exports={register,login,me};
