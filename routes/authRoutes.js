const express=require("express");const {body}=require("express-validator");const auth=require("../middleware/authMiddleware");const c=require("../controllers/authController");const router=express.Router();
router.post("/register",body("name").trim().isLength({min:2,max:80}).withMessage("Name must be 2-80 characters"),body("email").isEmail().withMessage("Enter a valid email"),body("password").isLength({min:6}).withMessage("Password must be at least 6 characters"),c.register);
router.post("/login",body("email").isEmail().withMessage("Enter a valid email"),body("password").notEmpty().withMessage("Password is required"),c.login);
router.get("/me",auth,c.me);module.exports=router;
