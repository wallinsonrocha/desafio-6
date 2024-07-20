/*
verificação tanto por cookie como por token string
*/
import { Request, Response, NextFunction } from "express";
import db from "../services/db";
import { errorHandler } from "../handlers/errorHandler";
import jwt from "jsonwebtoken";
import mysql from "mysql2";

export default async function auth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token: any = req.query.token;

    if (token === undefined || token === null || token === "") {
      throw new Error("customError: Missing Token!");
    }

    const decoded: any = jwt.verify(token, process.env.JWT_SECRET!, {
      algorithms: ["HS256"],
    });

    const user: any = (await db.query(
      `SELECT * FROM ${db.tableName.users} WHERE id = ${decoded.token} AND token_timestamp = ${decoded.timestamp};`
    )) as mysql.ResultSetHeader[];

    if (user.length === 0) {
      throw new Error("customError: Invalid or Unauthorized Token!");
    }

    if (String(req.path).startsWith("/users")) {
      if (user[0].access_level < 3) {
        throw new Error("customError: Non-existent or permissionless route");
      }
    }

    res.locals.access_level = user[0].access_level;

    next();
  } catch (error) {
    if (
      String(error).includes("Cannot read properties of null") ||
      String(error).includes("invalid signature") ||
      String(error).includes("jwt malformed")
    ) {
      return await errorHandler(res, "customError: Invalid Token!");
    }

    await errorHandler(res, String(error));
  }
}
