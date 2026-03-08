import { Schema, model, Document } from "mongoose";

export interface IQuestion {
    question: string;
    answers: string[];
    correctAnswerIndex: number;
    timeLimit: number;
}

export interface IQuiz extends Document {
    title: string;
    questions: IQuestion[];
    createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
    question: {
        type: String,
        required: true
    },
    answers: {
        type: [String],
        required: true
    },
    correctAnswerIndex: {
        type: Number,
        required: true
    },
    timeLimit: {
        type: Number,
        default: 10
    }
});

const QuizSchema = new Schema<IQuiz>({
    title: {
        type: String,
        required: true
    },
    questions: [QuestionSchema]
}, { timestamps: true });

export default model<IQuiz>("Quiz", QuizSchema);
