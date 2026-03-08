import type { Request, RequestHandler } from 'express';
import type { IUser, TokenType } from '../models/user.ts';

export interface IUserRequest extends Request {
    user?: IUser,
    token?: string
}

export interface IAuth extends RequestHandler {
  req: IUserRequest;
} 