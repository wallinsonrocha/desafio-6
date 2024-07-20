import cookieParse from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express, { Request, Response } from "express";
import auth from "./middlewares/auth";
import loginRouter from "./routes/login";
import paymentStatusRouter from "./routes/paymentStatus";
import productsRouter from "./routes/products";
import regenerateTokenRouter from "./routes/regenerateToken";
import requestsRouter from "./routes/requests";
import usersRouter from "./routes/users";
import db from "./services/db";

const app = express();
const port = 5173;

dotenv.config();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParse());

app.get("/", async (req: Request, res: Response) => {
	await db.dbConnect();
	res.status(200).json({ by: "Leonardo Delgado" });
});

app.use(loginRouter);
app.use(regenerateTokenRouter);
app.use(auth, usersRouter);
app.use(auth, productsRouter);
app.use(auth, requestsRouter);
app.use(auth, paymentStatusRouter);

app.listen(port, () => {
	console.log("Listening at port: " + port);
});
