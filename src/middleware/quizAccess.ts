import type { NextFunction, Response } from "express";
import { StatusCodes } from "http-status-codes";
import type { IUserRequest } from "../types/request.ts";
import type { IQuiz } from "../models/quiz.ts";
import { QuizService } from "../services/quizService.ts";

export interface IQuizRequest extends IUserRequest {
  quiz?: IQuiz;
}

type AccessLevel = "view" | "edit" | "owner";

const getUserPermission = (quiz: IQuiz, userId: string) =>
  quiz.sharedWith.find((s) => {
    const sharedUser = s.user._id;
    return sharedUser?.toString() === userId;
  })?.permission;

export const requireQuizAccess =
  (level: AccessLevel) =>
  async (req: IQuizRequest, res: Response, next: NextFunction) => {
    try {
      const quiz = await QuizService.getQuizById(req.params.quizId);
      if (!quiz) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: "Quiz not found",
        });
        return;
      }

      const userId = req.user!._id.toString();
      const isOwner = quiz.owner._id.toString() === userId;
      const permission = getUserPermission(quiz, userId);

      let allowed = false;
      if (level === "view") allowed = isOwner || !!permission;
      else if (level === "edit") allowed = isOwner || permission === "עריכה";
      else if (level === "owner") allowed = isOwner;

      if (!allowed) {
        res.status(StatusCodes.FORBIDDEN).json({
          success: false,
          error: "Not authorized to access this quiz",
        });
        return;
      }

      req.quiz = quiz;
      next();
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to authorize quiz access",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
