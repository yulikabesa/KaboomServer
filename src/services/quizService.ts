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
    return Quiz.findById(id);
  }

  // GET quizes by owner
  static async getQuizesByOwner(ownerId: string): Promise<IQuiz[]> {
    return Quiz.find({ owner: ownerId })
      .populate("sharedWith.user", "name email")
      .sort({ createdAt: -1 });
  }

  // GET quizes shared with user
  static async getQuizesSharedWith(userId: string): Promise<IQuiz[]> {
    return Quiz.find({
      "sharedWith.user": userId,
    })
      .populate("sharedWith.user", "name email")
      .sort({ createdAt: -1 });
  }
}
