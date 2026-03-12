import express from "express";
const router = express.Router();
import { QuizController } from "../controllers/quizController.ts";
// POST create quiz

router.post("/", QuizController.createQuiz);

// GET quiz by ID

router.get("/:id", QuizController.getQuizById);

// UPDATE quiz (for editing)

router.patch("/update/:id", QuizController.updateQuiz);

export default router;
