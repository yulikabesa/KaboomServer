import type { Response } from "express";
import { StatusCodes } from "http-status-codes";
import { QuizService } from "../services/quizService.ts";
import type { IUserRequest } from "../types/request.ts";
import type { IQuizRequest } from "../middleware/quizAccess.ts";

const getRequestorId = (req: IUserRequest) => req.user!._id.toString();

export class QuizController {
  // POST create new quiz
  static async createQuiz(req: IUserRequest, res: Response): Promise<void> {
    try {
      const quiz = await QuizService.createQuiz({
        ...req.body,
        owner: getRequestorId(req),
      });
      res.status(StatusCodes.CREATED).json({
        success: true,
        data: { quiz },
      });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to create a quiz",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // GET quiz by ID
  static async getQuizById(req: IQuizRequest, res: Response): Promise<void> {
    res.json({
      success: true,
      data: { quiz: req.quiz },
    });
  }

  static async getOwnedQuizzes(
    req: IUserRequest,
    res: Response,
  ): Promise<void> {
    try {
      const quizzes = await QuizService.getOwnedQuizzes(getRequestorId(req));
      res.json(quizzes);
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to fetch quizzes",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getSharedQuizzes(
    req: IUserRequest,
    res: Response,
  ): Promise<void> {
    try {
      const quizzes = await QuizService.getSharedQuizzes(getRequestorId(req));
      res.json(quizzes);
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to fetch shared quizzes",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  // UPDATE quiz
  static async updateQuiz(req: IQuizRequest, res: Response): Promise<void> {
    const allowedUpdates = [
      "coverImage",
      "title",
      "questions",
      "sharedWith",
      "tags",
    ] as const;

    type AllowedUpdateFields = (typeof allowedUpdates)[number];
    const updates = Object.keys(req.body);

    const isValidOperation = updates.every((field) =>
      allowedUpdates.includes(field as AllowedUpdateFields),
    );

    if (!isValidOperation) {
      res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "Invalid updates fields" });
      return;
    }

    try {
      const quiz = req.quiz!;
      updates.forEach((field) => {
        (quiz as any)[field] = req.body[field];
      });

      await quiz.save();
      res.status(StatusCodes.OK).json(quiz);
    } catch (e) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
    }
  }

  static async deleteQuiz(req: IQuizRequest, res: Response): Promise<void> {
    try {
      const deleted = await QuizService.deleteQuiz(req.params.quizId);
      res.send(deleted);
    } catch (e) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
    }
  }
}
