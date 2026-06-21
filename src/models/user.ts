import mongoose, { Model, ObjectId } from "mongoose";
// import bcrypt from 'bcryptjs';
import * as bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Document } from "mongoose";

export type TokenType = {
  token: string;
};

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  personalNumber: string;
  password: string;
  // todo: remove isAdmin
  isAdmin: boolean;
  tokens: TokenType[];
  generateAuthToken: () => Promise<string>;
}

interface IUserModel extends Model<IUser> {
  findByCredentials(
    email: string,
    password: string,
  ): Promise<
    Document<unknown, {}, IUser> & IUser & Required<{ _id: ObjectId }>
  > | null;
}

const userSchema = new mongoose.Schema<IUser, IUserModel>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    validate(value: String) {
      if (!value.includes("@")) {
        throw new Error('email must include "@"!');
      }
    },
  },
  personalNumber: {
    type: String,
    required: true,
    trim: true,
    unique: true,
    validate(value: String) {
      if (value.toString().length !== 7) {
        throw new Error("length must be 7!");
      }
    },
  },
  password: {
    type: String,
    required: true,
    trim: true,
    minlength: 3,
    validate(value: String) {
      if (value.toLowerCase().includes("password")) {
        throw new Error('password cannot contain "password"');
      }
    },
  },
  isAdmin: {
    type: Boolean,
    default: false,
  },
  tokens: [
    {
      token: {
        type: String,
        required: true,
      },
    },
  ],
});

userSchema.methods.toJSON = function () {
  const user = this;
  const userObject = user.toObject();

  delete userObject.password;
  delete userObject.tokens;

  return userObject;
};

userSchema.methods.generateAuthToken = async function () {
  const user = this;
  const token = jwt.sign(
    {
      _id: user._id.toString(),
      email: user.email,
      name: user.name,
    },
    process.env.JWT_SECRET as string,
    { expiresIn: "365d" },
  );

  user.tokens = user.tokens.concat({ token });
  await user.save();

  return token;
};

userSchema.statics.findByCredentials = async (
  email: string,
  password: string,
) => {
  const user = await User.findOne({ email });

  if (!user) {
    throw new Error("Unable to login");
  }

  const isMatch = await bcrypt.compare(password, user.password as string);

  if (!isMatch) {
    throw new Error("Unable to login");
  }

  return user;
};

// Hash the plain text password before saving
userSchema.pre("save", async function (next) {
  const user = this;

  if (user.isModified("password")) {
    user.password = await bcrypt.hash(user.password as string, 8);
  }

  next();
});

const User = mongoose.model<IUser, IUserModel>("User", userSchema);

export default User;
