import { IUser } from "../models/user";

declare global {
    declare namespace Express {
        export interface Request {
            user?: IUser,
            token?: string
        }
    }
}