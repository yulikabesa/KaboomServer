import User from "../models/user.ts";
import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
// import RequestModel from "../models/request";
import type { IUserRequest } from "../types/request.ts";
import { UserService } from "../services/userService.ts";

export class UserController {
  // POST create new user
  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await UserService.createUser(req.body);
      const token = await user.generateAuthToken();
      console.log({ user, token }); // to delete later
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { user, token },
      });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to create a user",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // POST login user creates new token
  static async loginUser(req: Request, res: Response): Promise<void> {
    try {
      const user = await User.findByCredentials(
        req.body.email,
        req.body.password
      );
      if (!user) {
        res
          .status(StatusCodes.BAD_REQUEST)
          .json({ success: false, error: "user doesnt exist" });
        return;
      }
      const token = await user.generateAuthToken();
      res.json({ success: true, data: { user, token } });
    } catch (e) {
      res.status(StatusCodes.BAD_REQUEST).json({});
    }
  }

  // POST logout user
  static async logoutUser(req: IUserRequest, res: Response): Promise<void> {
    try {
      req.user!.tokens = req.user!.tokens.filter((token: any) => {
        return token.token !== req.token;
      });
      await req.user!.save();
      res.json({});
    } catch (e) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({});
    }
  }

  // GET user by ID
  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      const user = await UserService.getUserById(req.params.id);

      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: "didnt find user",
        });
        return;
      }
      res.json({
        success: false,
        data: { user },
      });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to find user",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // UPDATE user
  static async updateUser(req: Request, res: Response): Promise<void> {
    type AllowedUpdateFields = "name" | "email" | "password" | "personalNumber";
    const updates = Object.keys(req.body) as AllowedUpdateFields[];
    const allowedUpdates = ["name", "email", "password", "personalNumber"];

    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      res.status(400).json({ error: "Invalid updates! " });
      return;
    }

    try {
      const user = await UserService.getUserById(req.params.id);
      if (!user) {
        res.status(StatusCodes.NOT_FOUND).json({});
        return;
      }
      updates.forEach(
        (update: AllowedUpdateFields) =>
          ((user as any)[update] = req.body[update])
      );
      await user.save();
      res.json(user);
    } catch (e) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
    }
  }
}
