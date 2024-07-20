import express, { Request, Response } from "express";
import db from "../services/db";
import mysql from "mysql2";
import validator from "validator";
import { TransformType, textTransform } from "text-transform";
import { cpf as cpfValidator } from "cpf-cnpj-validator";
import bcrypt from "bcrypt";
import { errorHandler } from "../handlers/errorHandler";

const router = express.Router();

router.get("/users", async (req: Request, res: Response) => {
  try {
    const result = await db.query(`SELECT * FROM ${db.tableName.users};`);
    res.status(200).json({
      data: result,
    });
  } catch (error) {
    await errorHandler(res, String(error));
  }
});

router.get("/users/:id", async (req: Request, res: Response) => {
  try {
    const userId: any = req.params.id;

    if (isNaN(userId)) {
      throw new Error("customError: Invalid Id!");
    }

    const result = await db.query(
      `SELECT * FROM ${db.tableName.users} WHERE id = ${userId} LIMIT 1;`
    );
    res.status(200).json({
      data: result,
    });
  } catch (error) {
    await errorHandler(res, String(error));
  }
});

router.post("/users", async (req: Request, res: Response) => {
  try {
    if (res.locals.access_level < 4) {
      throw new Error(
        "customError: You don't have permission for create a user!"
      );
    }

    const postValues = Object.values(await userDataProcessing(req));

    if (postValues.includes(undefined)) {
      throw new Error(
        "customError: There are empty or missing fields, fill in or add them!"
      );
    }

    const result = (await db.query(
      `INSERT INTO ${db.tableName.users}(name, cpf, email, pass, gender, access_level) 
            VALUES(?, ?, ?, ?, ?, ?)`,
      postValues
    )) as mysql.ResultSetHeader;

    res.status(201).json({
      message: `User (#${result.insertId}) has been created!`,
    });
  } catch (error) {
    const dupKey = db.hasStringDuplicatedKeys(
      String(error),
      db.tableName.users
    );
    if (dupKey) {
      return await errorHandler(
        res,
        `customError: The entry key '${dupKey}' already exists!`
      );
    }

    if (String(error).includes("Data truncated")) {
      return await errorHandler(
        res,
        "customError: Request denied! Check that there are no incorrectly filled values!",
        400,
        ""
      );
    }

    await errorHandler(res, String(error));
  }
});

router.put("/users/:id", async (req: Request, res: Response) => {
  try {
    if (res.locals.access_level < 4) {
      throw new Error(
        "customError: You don't have permission for update a user!"
      );
    }

    const userId: any = req.params.id;
    if (isNaN(userId)) {
      throw new Error("customError: Invalid Id!");
    }

    if (userId == 1) {
      throw new Error("customError: This id can't be updated!");
    }

    const updatedValues = await userDataProcessing(req);

    let updateArray: (string | number)[] = [];
    let updateString = "";
    Object.keys(updatedValues).forEach((key, index) => {
      if (Object.values(updatedValues)[index] === undefined) {
        return;
      }

      if (updateArray.length > 0) {
        updateString += ", ";
      }

      updateArray.push(Object.values(updatedValues)[index]);
      updateString += `${key.replace("tr_", "")} = ?`;
    });

    if (updateArray.length === 0) {
      throw new Error(
        "customError: You must enter a valid value to be changed!"
      );
    }

    const sql = String(
      `UPDATE ${db.tableName.users} SET <updateString>, updated_at = NOW() WHERE id = ${userId};`
    ).replace("<updateString>", updateString);
    const result = (await db.query(sql, updateArray)) as mysql.ResultSetHeader;

    if (result.affectedRows <= 0) {
      throw new Error("customError: User not found!");
    }

    res.status(200).json({
      message: `User (#${userId}) has been updated!`,
    });
  } catch (error) {
    const dupKey = db.hasStringDuplicatedKeys(
      String(error),
      db.tableName.users
    );
    if (dupKey) {
      return await errorHandler(
        res,
        `customError: The entry key '${dupKey}' already exists!`
      );
    }

    if (String(error).includes("Data truncated")) {
      return await errorHandler(
        res,
        "customError: Request denied! Check that there are no incorrectly filled values!",
        400,
        ""
      );
    }

    await errorHandler(res, String(error));
  }
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  try {
    if (res.locals.access_level < 4) {
      throw new Error(
        "customError: You don't have permission for delete a user!"
      );
    }

    const userId: any = req.params.id;
    if (isNaN(userId)) {
      throw new Error("customError: Invalid Id!");
    }

    if (userId == 1) {
      throw new Error("customError: This id can't be deleted!");
    }

    const sql = `DELETE FROM ${db.tableName.users} WHERE id = ${userId};`;
    const result = (await db.query(sql)) as mysql.ResultSetHeader;

    if (result.affectedRows <= 0) {
      throw new Error("customError: User not found!");
    }

    await db.query(
      `DELETE FROM ${db.tableName.requests} WHERE user_id = ${userId}`
    );

    res.status(200).json({
      message: `User (#${userId}) has been deleted!`,
    });
  } catch (error) {
    await errorHandler(res, String(error));
  }
});

async function userDataProcessing(req: Request) {
  const { name, cpf, email, pass, gender, access_level } = req.body;

  const tr_name = name
    ? textTransform(String(name), TransformType.title).trim()
    : undefined;

  if (tr_name !== undefined) {
    if (tr_name === "") {
      throw new Error("customError: Name can't be empty!");
    }

    if (tr_name.length < 3) {
      throw new Error(
        "customError: Name must contain a minimum of 3 characters!"
      );
    }

    if (/^[A-zÀ-ú\s]*$/.test(tr_name) === false) {
      throw new Error(
        "customError: Name must contain only letters and spaces!"
      );
    }
  }

  let tr_cpf = cpf ? String(cpf).replace(/\D/g, "") : undefined;
  if (tr_cpf !== undefined) {
    if (!cpfValidator.isValid(tr_cpf)) {
      throw new Error("customError: Invalid Cpf!");
    }
    tr_cpf = cpfValidator.format(tr_cpf);
  }

  const tr_email = email ? String(email).toLowerCase() : undefined;
  if (tr_email !== undefined) {
    if (!validator.isEmail(tr_email)) {
      throw new Error("customError: Invalid Email!");
    }
  }

  const tr_pass = pass ? bcrypt.hashSync(pass, 10) : undefined;
  if (tr_pass !== undefined) {
    if (String(pass).length > 32 || String(pass).length < 8) {
      throw new Error(
        "customError: Invalid Password! The password must contain a minimum of 8 characters and a maximum of 32"
      );
    }
  }

  let tr_gender: any =
    gender !== undefined ? String(gender).toUpperCase() : undefined;
  if (tr_gender !== undefined) {
    if (tr_gender !== "M" && tr_gender !== "F") {
      tr_gender = null;
    }
  }

  let tr_access_level = access_level;
  if (tr_access_level !== undefined) {
    if (access_level < 1 || access_level > 4) {
      tr_access_level = 1;
    }
  }

  return { tr_name, tr_cpf, tr_email, tr_pass, tr_gender, tr_access_level };
}

export default router;
