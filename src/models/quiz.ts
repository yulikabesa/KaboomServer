import { Schema, model, Document, Types } from "mongoose";

export interface IQuestion {
  questionImage?: string;
  questionText: string;
  answerOptions: string[];
  correctIndexes: number[];
  timeLimit: number;
  scoringWeight: number;
}

export type Permission = "צפייה" | "עריכה";

export interface ISharedUser {
  user: QuizUser | Types.ObjectId;
  permission: Permission;
}

export interface QuizUser {
  _id: Types.ObjectId;
  name: string;
  email: string;
}

export interface IQuiz extends Document {
  owner: QuizUser | Types.ObjectId;
  coverImage?: string;
  title: string;
  questions: IQuestion[];
  tags: string[];
  sharedWith: ISharedUser[];
  createdAt: Date;
}

const QuestionSchema = new Schema<IQuestion>({
  questionImage: {
    type: String,
    required: false,
  },
  questionText: {
    type: String,
    default: "",
  },
  answerOptions: {
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
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    coverImage: {
      type: String,
      // default: ,
      // todo ask design team to create image for default cover
    },
    title: {
      type: String,
      required: true,
    },
    questions: {
      type: [QuestionSchema],
      required: true,
    },
    tags: {
      type: [String],
      default: [],
    },
    sharedWith: {
      type: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          permission: {
            type: String,
            enum: ["צפייה", "עריכה"],
            default: "צפייה",
          },
        },
      ],
      default: [],
    },
  },
  { timestamps: true },
);

export default model<IQuiz>("Quiz", QuizSchema);
