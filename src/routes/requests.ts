import express, { Request, Response } from 'express';
import db from '../services/db';
import mysql from 'mysql2';
import { format as dateFormat } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { errorHandler } from '../handlers/errorHandler';
import { clamp } from '../utils/mathF';

const router = express.Router();

router.get('/requests', async (req: Request, res: Response) => {
    try {
        const result = await db.query(`
            SELECT 
                r.*, 
                u.name AS "user_name", u.cpf AS "user_cpf", 
                p.name AS "product_name", p.price AS "product_price",
                ps.description AS "payment_status_description"
            FROM ${db.tableName.requests} r
            LEFT JOIN ${db.tableName.users} u ON u.id = r.user_id
            LEFT JOIN ${db.tableName.products} p ON p.id = r.product_id
            LEFT JOIN ${db.tableName.payment_status} ps ON ps.id = r.payment_status_id
        `);
        res.status(200).json({
            data: result
        });

    } catch (error) {
        await errorHandler(res, String(error));
    }
});

router.get('/requests/:id', async (req: Request, res: Response) => {
    try {
        const requestId: any = req.params.id;
        if (isNaN(requestId)) {
            throw new Error("customError: Invalid Id!");
        }

        const result = await db.query(`
            SELECT 
                r.*, 
                u.name AS "user_name", u.cpf AS "user_cpf", 
                p.name AS "product_name", p.price AS "product_price",
                ps.description AS "payment_status_description"
            FROM ${db.tableName.requests} r
            LEFT JOIN ${db.tableName.users} u ON u.id = r.user_id
            LEFT JOIN ${db.tableName.products} p ON p.id = r.product_id
            LEFT JOIN ${db.tableName.payment_status} ps ON ps.id = r.payment_status_id
            WHERE r.id = ${requestId} 
            LIMIT 1;
        `);
        res.status(200).json({
            data: result
        });

    } catch (error) {
        console.log(error)
        await errorHandler(res, String(error));
    }
});

router.post('/requests', async (req: Request, res: Response) => {
    try {
        const postValues = Object.values(await requestDataProcessing(req));

        if (postValues.includes(undefined)) {
            throw new Error("customError: There are empty or missing fields, fill in or add them!");
        }

        const userId = postValues[0];
        const productId = postValues[1];
        const paymentStatusId = postValues[2];
        const product_count = postValues[3];
        const requested_at = postValues[4];
        const delivered_at = postValues[5];

        // Verificação se a data do pedido não é maior que a data de entrega
        if (delivered_at !== null) {
            if (new Date(delivered_at).valueOf() - new Date(requested_at).valueOf() < 0) {
                throw new Error("customError: The delivery date cannot be less than the order date!");
            }
        }

        // Verificação se todas chaves estrangeiras existem
        const foreignKeys: any = await db.query(`
            SELECT u.id AS "user_id", p.id AS "product_id", ps.id AS "payment_status_id"
            FROM ${db.tableName.requests}
            LEFT JOIN ${db.tableName.users} u ON u.id = ?
            LEFT JOIN ${db.tableName.products} p ON p.id = ?
            LEFT JOIN ${db.tableName.payment_status} ps ON ps.id = ? 
            LIMIT 1;`, [userId, productId, paymentStatusId]
        );

        Object.values(foreignKeys[0]).forEach((value, index) => {
            if (value === null) {
                const keyName = Object.keys(foreignKeys[0])[index];
                throw new Error(`customError: The value of '${keyName}' entered does not exist`);
            }
        });

        // Verifica se a quantidade do produto solicitado não excede o estoque atual
        const currentStock: any = (await db.query(`SELECT stock FROM ${db.tableName.products} WHERE id = ${productId};`));
        if (currentStock[0].stock - product_count < 0) {
            throw new Error(`customError: The order quantity entered exceeds the current inventory of the product (stock: ${currentStock[0].stock})`);
        }

        const result = await db.query(`INSERT INTO ${db.tableName.requests}(user_id, product_id, payment_status_id, product_count, requested_at, delivered_at, applied_discount) 
            VALUES(?, ?, ?, ?, ?, ?, ?)`, postValues ) as mysql.ResultSetHeader;

        await db.query(`UPDATE ${db.tableName.products} SET stock = stock - ${product_count} WHERE id = ${productId};`);
        
        res.status(201).json({
            message: `Request (#${result.insertId}) has been created!`
        });

    } catch (error) {
        const dupKey = db.hasStringDuplicatedKeys(String(error), db.tableName.requests);
        if (dupKey) {
            return await errorHandler(res, `customError: The entry key '${dupKey}' already exists!`);
        }

        if (String(error).includes("Data truncated")) {
            return await errorHandler(res, "customError: Request denied! Check that there are no incorrectly filled values!", 400, "");
        }

        await errorHandler(res, String(error));
    }
});

router.put('/requests/:id', async (req: Request, res: Response) => {
    try {
        const requestId: any = req.params.id;
        if (isNaN(requestId)) {
            throw new Error("customError: Invalid Id!");
        }
        
        const updatedValues = await requestDataProcessing(req);

        const userId = Object.values(updatedValues)[0];
        const productId = Object.values(updatedValues)[1];
        const paymentStatusId = Object.values(updatedValues)[2];
        const product_count = Object.values(updatedValues)[3];
        let requested_at = Object.values(updatedValues)[4];
        let delivered_at = Object.values(updatedValues)[5];

        
        const actualValues: any = await db.query(`
            SELECT r.*, p.stock AS "product_stock"
            FROM ${db.tableName.requests} r
            LEFT JOIN ${db.tableName.products} p ON p.id = r.product_id
            WHERE r.id = ${requestId};
        `);

        if (productId !== actualValues[0].product_id) {
            throw new Error("customError: You can't change product_id after created a request!")
        }

        if (userId !== actualValues[0].user_id) {
            throw new Error("customError: You can't change user_id after created a request!")
        }
        
        // Verificação se a data do pedido não é maior que a data de entrega
        if (delivered_at !== null) {
            requested_at = requested_at !== undefined ? requested_at : actualValues[0].requested_at; 
            delivered_at = delivered_at !== undefined ? delivered_at : actualValues[0].delivered_at;

            if (new Date(delivered_at).valueOf() - new Date(requested_at).valueOf() < 0) {
                throw new Error("customError: The delivery date cannot be less than the order date!");
            }
        }

        // Verificação se todas chaves estrangeiras existem
        const foreignKeys: any = await db.query(`
            SELECT ps.id AS "payment_status_id"
            FROM ${db.tableName.requests}
            LEFT JOIN ${db.tableName.payment_status} ps ON ps.id = ? 
            LIMIT 1;`, [paymentStatusId]
        );

        // Verifica se a quantidade do produto solicitado não excede o estoque atual
        const newStock = actualValues[0].product_stock + (actualValues[0].product_count - product_count);
        if (product_count !== undefined) {
            if (newStock < 0) {
                throw new Error(`customError: The order quantity entered exceeds the current inventory of the product (stock: ${actualValues[0].product_stock})`);
            }
        }
        

        Object.values(foreignKeys[0]).forEach((value, index) => {
            if (value === null) {
                if (Object.values(updatedValues)[index] !== undefined) {
                    const keyName = Object.keys(foreignKeys[0])[index];
                    throw new Error(`customError: The value of '${keyName}' entered does not exist`);
                }
            }
        });


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

        const sql = String(`UPDATE ${db.tableName.requests} SET <updateString> WHERE id = ${requestId};`).replace("<updateString>", updateString);
        const result = await db.query(sql, updateArray) as mysql.ResultSetHeader;

        if (result.affectedRows <= 0) {
            throw new Error("customError: Request not found!");
        }

        // Atualização do estoque
        if (product_count !== undefined) {
            await db.query(`UPDATE ${db.tableName.products} SET stock = ${newStock} WHERE id = ${actualValues[0].product_id};`);
        }
        
        res.status(200).json({
            message: `Request (#${requestId}) has been updated!`,
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

router.delete('/requests/:id', async (req: Request, res: Response) => {
    try {
        const requestId: any = req.params.id;
        if (isNaN(requestId)) {
            throw new Error("customError: Invalid Id!");
        }

        const sql = `DELETE FROM ${db.tableName.requests} WHERE id = ${requestId};`;
        const result = await db.query(sql) as mysql.ResultSetHeader;

        if (result.affectedRows <= 0) {
            throw new Error("customError: Request not found!");
        }

        res.status(200).json({
            message: `Request (#${requestId}) has been deleted!`,
        });

    } catch (error) {
        await errorHandler(res, String(error));
    }
});


async function requestDataProcessing(req: Request) {
    const { user_id, product_id, payment_status_id, product_count, requested_at, delivered_at, applied_discount } = req.body;

    if (isNaN(user_id)) {
        throw new Error("customError: Invalid User Id!");
    }

    if (isNaN(product_id)) {
        throw new Error("customError: Invalid Product Id!");
    }

    if (isNaN(payment_status_id)) {
        throw new Error("customError: Invalid Payment Status Id!");
    }

    const tr_product_count = product_count ? product_count : undefined;
    if (tr_product_count !== undefined) {
        if (isNaN(tr_product_count) || tr_product_count < 0) {
            throw new Error("customError: Invalid Product Count!");
        }
    }

    let tr_applied_discount = applied_discount ? applied_discount : undefined;

    if (tr_applied_discount !== undefined) {
        if (isNaN(tr_applied_discount)) {
            throw new Error("customError: Invalid Discount!");
        }
        tr_applied_discount = clamp(applied_discount, 0, 100);
    }

    let tr_requested_at = requested_at ? requested_at : undefined;
    if (tr_requested_at !== undefined) {
        try {
            tr_requested_at = dateFormat(new Date(requested_at), "yyyy-MM-dd HH:mm:ss", { locale: ptBR });
        } catch {
            throw new Error("customError: Invalid requested date!");
        }
    }

    let tr_delivered_at = delivered_at ? delivered_at : undefined;
    if (tr_delivered_at !== undefined) {
        try {
            tr_delivered_at = dateFormat(new Date(tr_delivered_at), "yyyy-MM-dd HH:mm:ss", { locale: ptBR });;
        } catch {
            throw new Error("customError: Invalid delivered date!");
        }
    }

    return { user_id, product_id, payment_status_id, tr_product_count, tr_requested_at, tr_delivered_at, tr_applied_discount };
}

export default router;