import { Schema, model, Document } from "mongoose";

export interface IQuestion {
  questionImage?: string;
  question: string;
  answers: string[];
  correctIndexes: number[];
  timeLimit: number;
  scoringWeight: number;
}

export interface IQuiz extends Document {
  coverImage?: string;
  title: string;
  questions: IQuestion[];
  createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  questionImage: {
    type: String,
    required: false,
  },
  question: {
    type: String,
    required: true,
  },
  answers: {
    type: [String],
    required: true,
  },
  correctIndexes: {
    type: [Number],
    required: true,
  },
  timeLimit: {
    type: Number,
    default: 10,
  },
  scoringWeight: {
    type: Number,
    default: 1,
  },
});

const QuizSchema = new Schema<IQuiz>(
  {
    coverImage: {
      type: String,
      // default: ,
      // todo ask design team to create image for default cover
    },
    title: {
      type: String,
      required: true,
    },
    questions: [QuestionSchema],
  },
  { timestamps: true },
);

export default model<IQuiz>("Quiz", QuizSchema);
