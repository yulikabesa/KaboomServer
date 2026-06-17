import express from "express";
import { QuizController } from "../controllers/quizController.ts";
import { auth } from "../middleware/auth.ts";
import { requireQuizAccess } from "../middleware/quizAccess.ts";

const router = express.Router();
router.use(auth);

// POST create quiz

router.post("/", QuizController.createQuiz);

// GET quizzes by owner

router.get("/owner/", QuizController.getOwnedQuizzes);

// GET quizzes shared with user

router.get("/shared/", QuizController.getSharedQuizzes);

// UPDATE quiz (for editing)

router.patch("/:quizId", requireQuizAccess("edit"), QuizController.updateQuiz);

// GET quiz by ID

router.get("/:quizId", requireQuizAccess("view"), QuizController.getQuizById);

// DELETE quiz

router.delete(
  "/:quizId",
  requireQuizAccess("owner"),
  QuizController.deleteQuiz,
);

export default router;
