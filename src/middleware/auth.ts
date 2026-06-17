import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import User from "../models/user.ts";
import { StatusCodes } from "http-status-codes";
import type { NextFunction, Response } from "express";
import type { IUserRequest } from "../types/request.ts";

export const auth = async (
  req: IUserRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const token = req.header("authorization")?.replace("Bearer ", "");
    const decoded = jwt.verify(token!, process.env.JWT_SECRET!) as JwtPayload;
    const user = await User.findOne({
      _id: decoded._id,
      "tokens.token": token,
    });

    if (!user) {
      throw new Error();
    }

    req.token = token;
    req.user = user;

    next();
  } catch (e) {
    res.status(StatusCodes.UNAUTHORIZED).json({ error: "Please authenticate" });
  }
};
