import express from "express";
import { auth } from "../middleware/auth.ts";
import { UserController } from "../controllers/userController.ts";

const router = express.Router();

// sign up
// POST create new user

router.post("/", UserController.createUser);

// login
// POST login user creates new token

router.post("/login", UserController.loginUser);

// logout
// POST logout user

router.post("/logout", auth, UserController.logoutUser);

// Get user

router.get("/search", auth, UserController.searchUsers);

// GET user by ID

// router.get("/:id", auth, UserController.getUserById);

// UPDATE user

// router.patch("/update/:id", auth, UserController.updateUser);

export default router;
