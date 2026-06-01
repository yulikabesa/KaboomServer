import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { QuizService } from "../services/quizService.ts";

export class QuizController {
  // POST create new quiz
  static async createQuiz(req: Request, res: Response): Promise<void> {
    try {
      const quiz = await QuizService.createQuiz(req.body);
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
  static async getQuizById(req: Request, res: Response): Promise<void> {
    try {
      const quiz = await QuizService.getQuizById(req.params.quizId);
      if (!quiz) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: "quiz does not exist",
        });
        return;
      }
      res.json({
        success: false,
        data: { quiz },
      });
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to find quiz",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getQuizesByOwner(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const quizzes = await QuizService.getQuizesByOwner(userId);

      res.json(quizzes);
    } catch (error) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
        success: false,
        error: "Failed to fetch quizzes",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  static async getQuizesSharedWith(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;

      const quizzes = await QuizService.getQuizesSharedWith(userId);

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
  static async updateQuiz(req: Request, res: Response): Promise<void> {
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
      const quiz = await QuizService.getQuizById(req.params.quizId);
      if (!quiz) {
        res.status(StatusCodes.NOT_FOUND).json({
          error: "Quiz not found",
        });
        return;
      }
      updates.forEach((field) => {
        (quiz as any)[field] = req.body[field];
      });

      await quiz.save();
      res.status(StatusCodes.OK).json(quiz);
    } catch (e) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
    }
  }

  static async deleteQuizById(req: Request, res: Response): Promise<void> {
    try {
      const quiz = await QuizService.deleteQuizById(req.params.quizId);
      if (!quiz) {
        res.status(StatusCodes.NOT_FOUND).json({
          success: false,
          error: "Quiz does not exist",
        });
        return;
      }
      res.send(quiz);
    } catch (e) {
      res.status(StatusCodes.INTERNAL_SERVER_ERROR).json(e);
    }
  }
}
