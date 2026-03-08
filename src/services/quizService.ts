import Quiz from "../models/quiz.ts";
import type { IQuiz } from "../models/quiz.ts";

export class QuizService {
  // Create new quiz
  static async createQuiz(body: IQuiz): Promise<IQuiz> {
    const user = new Quiz(body);

    await user.save();
    return user;
  }

  // GET quiz by id
  static async getQuizById(id: string): Promise<IQuiz | null> {
    return Quiz.findById(id);
  }
}