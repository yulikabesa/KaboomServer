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
  // to do!!
  static async updateQuiz(req: Request, res: Response): Promise<void> {
    // todo add the fields
    type AllowedUpdateFields = "x" | "xxx";
    const updates = Object.keys(req.body) as AllowedUpdateFields[];
    const allowedUpdates = ["x", "xx"];

    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update),
    );

    if (!isValidOperation) {
      res.status(400).json({ error: "Invalid updates! " });
      return;
    }

    try {
      const quiz = await QuizService.getQuizById(req.params.quizId);
      if (!quiz) {
        res.status(StatusCodes.NOT_FOUND).json({});
        return;
      }
      updates.forEach(
        (update: AllowedUpdateFields) =>
          ((quiz as any)[update] = req.body[update]),
      );
      await quiz.save();
      res.json(quiz);
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
