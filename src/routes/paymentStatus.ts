import express, { Request, Response } from 'express';
import db from '../services/db';
import mysql from 'mysql2';
import { errorHandler } from '../handlers/errorHandler';
import { TransformType, textTransform } from 'text-transform';

const router = express.Router();

router.get('/payment_status', async (req: Request, res: Response) => {
    try {
        const result = await db.query(`SELECT * FROM ${db.tableName.payment_status};`);

        res.status(200).json({
            data: result
        });

    } catch (error) {
        await errorHandler(res, String(error));
    }
});

router.get('/payment_status/:id', async (req: Request, res: Response) => {
    try {
        const paymentStatusId: any = req.params.id;
        if (isNaN(paymentStatusId)) {
            throw new Error("customError: Invalid Id!");
        }

        const result = await db.query(`SELECT * FROM ${db.tableName.payment_status} WHERE id = ${paymentStatusId} LIMIT 1;`);

        res.status(200).json({
            data: result
        });
        
    } catch (error) {
        await errorHandler(res, String(error));
    }
});

router.post('/payment_status', async (req: Request, res: Response) => {
    try {
        const postValues: any = Object.values(await paymentstatusDataProcessing(req));

        if (postValues.includes(undefined)) {
            throw new Error("customError: There are empty or missing fields, fill in or add them!");
        }

        const result = await db.query(`INSERT INTO ${db.tableName.payment_status}(description) 
            VALUES(?)`, postValues ) as mysql.ResultSetHeader;
        
        res.status(201).json({
            message: `Payment Status (#${result.insertId}) has been created!`
        });
    } catch (error) {

        if (String(error).includes("Data truncated")) {
            return await errorHandler(res, "customError: Request denied! Check that there are no incorrectly filled values!", 400, "");
        }

        await errorHandler(res, String(error));
    }
});

router.put('/payment_status/:id', async (req: Request, res: Response) => {
    try {
        const paymentStatusId: any = req.params.id;
        if (isNaN(paymentStatusId)) {
            throw new Error("customError: Invalid Id!");
        }

        const postValues: any = Object.values(await paymentstatusDataProcessing(req));

        if (postValues.includes(undefined)) {
            throw new Error("customError: There are empty or missing fields, fill in or add them!");
        }

        const result = await db.query(`UPDATE ${db.tableName.payment_status} SET description = ? WHERE id = ${paymentStatusId};`, postValues) as mysql.ResultSetHeader;

        if (result.affectedRows <= 0) {
            throw new Error("customError: Payment Status not found!");
        }
        
        res.status(201).json({
            message: `Payment Status (#${paymentStatusId}) has been updated!`,
        });
    } catch (error) {
        
        if (String(error).includes("Data truncated")) {
            return await errorHandler(res, "customError: Request denied! Check that there are no incorrectly filled values!", 400, "");
        }

        await errorHandler(res, String(error));
    }
});

router.delete("/payment_status/:id", async (req: Request, res: Response) => {
    try {
        const paymentStatusId: any = req.params.id;
        if (isNaN(paymentStatusId)) {
            throw new Error("customError: Invalid Id!");
        }

        const sql = `DELETE FROM ${db.tableName.payment_status} WHERE id = ${paymentStatusId};`;
        const result = await db.query(sql) as mysql.ResultSetHeader;

        if (result.affectedRows <= 0) {
            throw new Error("customError: Payment Status not found!");
        }
        
        res.status(200).json({
            message: `Payment Status (#${paymentStatusId}) has been deleted!`,
        });

    } catch (error) {
        await errorHandler(res, String(error));
    }
});

async function paymentstatusDataProcessing(req: Request) {
    const { description } = req.body;

    const tr_description = description ? textTransform(String(description), TransformType.title).trim() : undefined;

    if (tr_description !== undefined) {
        if (tr_description === '') {
            throw new Error("customError: Description can't be empty!");
        }

        if (tr_description.length < 3) {
            throw new Error("customError: Description must contain a minimum of 3 characters!");
        }

    }

    return { tr_description };
}


export default router;