import mongoose from "mongoose";
import Quiz from "../models/quiz.ts";
import type { IQuiz } from "../models/quiz.ts";

const baseListProjection = {
  title: 1,
  coverImage: 1,
  tags: 1,
  questionCount: { $size: { $ifNull: ["$questions", []] } },
};

export class QuizService {
  // Create new quiz
  static async createQuiz(body: IQuiz): Promise<IQuiz> {
    const quiz = new Quiz(body);
    await quiz.save();
    return quiz;
  }

  // GET quiz by id
  static async getQuizById(id: string): Promise<IQuiz | null> {
    return await Quiz.findById(id)
      .populate("owner", "name email")
      .populate("sharedWith.user", "name email");
  }

  // GET owned quizzes
  static async getOwnedQuizzes(ownerId: string) {
    return await Quiz.aggregate([
      { $match: { owner: new mongoose.Types.ObjectId(ownerId) } },
      {
        $project: {
          ...baseListProjection,
          canEdit: { $literal: true },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  // GET shared quizzes
  static async getSharedQuizzes(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    return await Quiz.aggregate([
      { $match: { "sharedWith.user": userObjectId } },
      {
        $project: {
          ...baseListProjection,
          canEdit: {
            $anyElementTrue: {
              $map: {
                input: "$sharedWith",
                as: "s",
                in: {
                  $and: [
                    { $eq: ["$$s.user", userObjectId] },
                    { $eq: ["$$s.permission", "עריכה"] },
                  ],
                },
              },
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
    ]);
  }

  // find and delete quiz
  static async deleteQuiz(userId: string): Promise<IQuiz[] | null> {
    return await Quiz.findByIdAndDelete(userId);
  }
}
