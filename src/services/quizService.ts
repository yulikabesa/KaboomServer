import Quiz from "../models/quiz.ts";
import type { IQuiz } from "../models/quiz.ts";

export class QuizService {
  // Create new quiz
  static async createQuiz(body: IQuiz): Promise<IQuiz> {
    const quiz = new Quiz(body);
    await quiz.save();
    return quiz;
  }

  // GET quiz by id
  static async getQuizById(id: string): Promise<IQuiz | null> {
    return Quiz.findById(id).populate("sharedWith.user", "name email");
  }

  // GET quizes by owner
  static async getOwnedQuizzes(ownerId: string): Promise<IQuiz[]> {
    return Quiz.find({ owner: ownerId })
      .populate("sharedWith.user", "name email")
      .sort({ createdAt: -1 });
  }

  // GET quizes shared with user
  static async getSharedQuizzes(userId: string): Promise<IQuiz[]> {
    return Quiz.find({
      "sharedWith.user": userId,
    })
      .populate("sharedWith.user", "name email")
      .sort({ createdAt: -1 });
  }

  // find and delete quiz
  static async deleteQuiz(userId: string): Promise<IQuiz[] | null> {
    return await Quiz.findByIdAndDelete(userId);
  }
}
