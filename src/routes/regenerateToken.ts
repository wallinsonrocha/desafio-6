import express, { Request, Response } from "express";
import db from "../services/db";
import bcrypt from "bcrypt";
import { errorHandler } from "../handlers/errorHandler";
import jwt from "jsonwebtoken";

const router = express.Router();

router.post(
  "/regenerate_token/:email/:password",
  async (req: Request, res: Response) => {
    try {
      const email = req.params.email;
      const password = req.params.password;

      const user: any = await db.query(
        `SELECT * FROM ${db.tableName.users} WHERE email = ? LIMIT 1;`,
        [email]
      );

      if (user.length === 0) {
        throw new Error("customError: Invalid email or password!");
      }

      if (!(await bcrypt.compare(password, user[0].pass))) {
        throw new Error("customError: Invalid email or password!");
      }

      const token_timestamp = new Date().valueOf();

      await db.query(
        `UPDATE ${db.tableName.users} SET token_timestamp = ${token_timestamp} WHERE id = ${user[0].id};`
      );

      const token = jwt.sign(
        {
          token: user[0].id,
          timestamp: token_timestamp,
        },
        process.env.JWT_SECRET!,
        { algorithm: "HS256", noTimestamp: true }
      );

      res.status(200).json({
        token,
      });
    } catch (error) {
      await errorHandler(res, String(error));
    }
  }
);

export default router;
