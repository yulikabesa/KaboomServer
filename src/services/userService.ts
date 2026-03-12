import User from "../models/user.ts";
import type { IUser } from "../models/user.ts";

export class UserService {
  // Create new user
  static async createUser(body: IUser): Promise<IUser> {
    const user = new User(body);
    await user.save();
    return user;
  }

  // GET user by id
  static async getUserById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }
}
