import { Schema, model, Document } from "mongoose";

export interface ITag extends Document {
  name: string;
  password: string;
}

const TagSchema = new Schema<ITag>({
  name: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
    minlength: 3,
  },
});


export default model<ITag>("Tag", TagSchema);
