/// <reference path="../types/express.d.ts" />
import express from "express";
const router = express.Router();
import { auth } from "../middleware/auth.ts";
import { UserController } from "../controllers/userController.ts";
import type { IAuth } from "../types/request.ts";

// sign up
// POST create new user

router.post("/", UserController.createUser);

// login
// POST login user creates new token

router.post("/login", UserController.loginUser);

// logout
// POST logout user

router.post("/logout", auth as IAuth, UserController.logoutUser);

// GET user by ID

router.get("/:id", auth, UserController.getUserById);

// UPDATE user

router.patch("/update/:id", auth, UserController.updateUser);

export default router;
