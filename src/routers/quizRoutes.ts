import express from "express";
const router = express.Router();
import { QuizController } from "../controllers/quizController.ts";

// POST create quiz

router.post("/", QuizController.createQuiz);

// GET quizzes by owner

router.get("/owner/:userId", QuizController.getQuizesByOwner);

// GET quizzes shared with user

router.get("/shared/:userId", QuizController.getQuizesSharedWith);

// UPDATE quiz (for editing)

router.patch("/update/:quizId", QuizController.updateQuiz);

// GET quiz by ID

router.get("/:quizId", QuizController.getQuizById);

// delete by id

router.delete('/:quizId', QuizController.deleteQuizById);

export default router;
