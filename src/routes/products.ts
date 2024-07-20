import express, { Request, Response } from 'express';
import db from '../services/db';
import mysql from 'mysql2';
import { TransformType, textTransform } from 'text-transform';
import { errorHandler } from '../handlers/errorHandler';
import { clamp } from '../utils/mathF';

const router = express.Router();

router.get('/products', async (req: Request, res: Response) => {
    try {
        const result = await db.query(`SELECT * FROM ${db.tableName.products};`);
        res.status(200).json({
            data: result
        });

    } catch (error) {
        await errorHandler(res, String(error));
    }
});

router.get('/products/:id', async (req: Request, res: Response) => {
    try {
        const productId: any = req.params.id;
        if (isNaN(productId)) {
            throw new Error("customError: Invalid Id!");
        }

        const result = await db.query(`SELECT * FROM ${db.tableName.products} WHERE id = ${productId} LIMIT 1;`);
        res.status(200).json({
            data: result
        });

    } catch (error) {
        await errorHandler(res, String(error));
    }
});

router.post('/products', async (req: Request, res: Response) => {
    try {
        const postValues = Object.values(await productDataProcessing(req));

        if (postValues.includes(undefined)) {
            throw new Error("customError: There are empty or missing fields, fill in or add them!");
        }

        const result = await db.query(`INSERT INTO ${db.tableName.products}(name, description, price, discount, stock) 
            VALUES(?, ?, ?, ?, ?);`, postValues) as mysql.ResultSetHeader;

        res.status(200).json({
            message: `Product (#${result.insertId}) has been created!`
        });

    } catch (error) {
        const dupKey = db.hasStringDuplicatedKeys(String(error), db.tableName.products);
        if (dupKey) {
            return await errorHandler(res, `customError: The entry key '${dupKey}' already exists!`);
        }

        if (String(error).includes("Data truncated")) {
            return await errorHandler(res, "customError: Request denied! Check that there are no incorrectly filled values!", 400, "");
        }

        await errorHandler(res, String(error));
    }
});

router.put('/products/:id', async (req: Request, res: Response) => {
    try {
        const productId: any = req.params.id;
        if (isNaN(productId)) {
            throw new Error("customError: Invalid Id!");
        }
        
        const updatedValues = await productDataProcessing(req);

        let updateArray: (string | number)[] = [];
        let updateString = "";
        Object.keys(updatedValues).forEach((key, index) => {
            if(Object.values(updatedValues)[index] === undefined) {
                return;
            }
            
            if (updateArray.length > 0) {
                updateString += ", ";
            }

            updateArray.push(Object.values(updatedValues)[index]);
            updateString += `${key.replace("tr_", "")} = ?`;
        });

        if (updateArray.length === 0) {
            throw new Error("customError: You must enter a valid value to be changed!");
        }

        const sql = String(`UPDATE ${db.tableName.products} SET <updateString> WHERE id = ${productId};`).replace("<updateString>", updateString);
        const result = await db.query(sql, updateArray) as mysql.ResultSetHeader;

        if (result.affectedRows <= 0) {
            throw new Error("customError: Product not found!");
        }
        
        res.status(200).json({
            message: `Product (#${productId}) has been updated!`,
        });

    } catch (error) {

        const dupKey = db.hasStringDuplicatedKeys(String(error), db.tableName.users);
        if (dupKey) {
            return await errorHandler(res, `customError: The entry key '${dupKey}' already exists!`);
        }

        if (String(error).includes("Data truncated")) {
            return await errorHandler(res, "customError: Request denied! Check that there are no incorrectly filled values!", 400, "");
        }

        await errorHandler(res, String(error));
    }
});

router.delete('/products/:id', async (req: Request, res: Response) => {
    try {
        const productId: any = req.params.id;
        if (isNaN(productId)) {
            throw new Error("customError: Invalid Id!");
        }

        const sql = `DELETE FROM ${db.tableName.products} WHERE id = ${productId};`;
        const result = await db.query(sql) as mysql.ResultSetHeader;

        if (result.affectedRows <= 0) {
            throw new Error("customError: Product not found!");
        }

        res.status(200).json({
            message: `Product (#${productId}) has been deleted!`,
        });

    } catch (error) {
        await errorHandler(res, String(error));
    }
});

async function productDataProcessing(req: Request) {
    const { name, description, price, discount, stock } = req.body;

    const tr_name = name ? textTransform(String(name), TransformType.title).trim() : undefined;

    if (tr_name !== undefined) {
        if (tr_name === '') {
            throw new Error("customError: Name can't be empty!");
        }

        if (tr_name.length < 3) {
            throw new Error("customError: Name must contain a minimum of 3 characters!");
        }

    }

    const tr_description = description ? description.trim() : undefined;

    const tr_price = price ? price : undefined;

    if (tr_price !== undefined) {
        if (isNaN(tr_price) || tr_price < 0) {
            throw new Error("customError: Invalid Price!");
        }
    }

    let tr_discount = discount ? discount : undefined;

    if (tr_discount !== undefined) {
        if (isNaN(tr_discount)) {
            throw new Error("customError: Invalid Discount!");
        }

        tr_discount = clamp(tr_discount, 0, 100);
    }

    const tr_stock = stock ? stock : undefined;

    if (tr_stock !== undefined) {
        if (isNaN(tr_stock) || tr_stock < 0) {
            throw new Error("customError: Invalid Stock!");
        }
    }

    return { tr_name, tr_description, tr_price, tr_discount, tr_stock };
}

export default router;