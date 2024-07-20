import mysql from "mysql2/promise";

enum tableName {
	"users" = "users",
	"requests" = "requests",
	"products" = "products",
	"payment_status" = "payment_status",
}

async function dbConnect(): Promise<mysql.Connection> {
	const conn = await mysql.createConnection({
		uri: process.env.DATABASE_URL!,
		multipleStatements: true,
	});
	try {
		conn.connect();
		console.log("Database connected!");
	} catch (error) {
		console.log(String(error));
	}

	return conn;
}

async function query(sql: string, values?: (string | number)[]) {
	const db = await dbConnect();
	const [rows] = await db.execute(sql, values);
	db.end();

	return rows;
}

// check if error string includes duplicate entry ocurrence and return duplicate column name;
function hasStringDuplicatedKeys(
	errorString: string,
	table: string
): string | null {
	if (errorString.includes("Duplicate entry")) {
		const keyNamePos = errorString.indexOf(`for key '${table}.`);
		let columnName = errorString
			.substring(keyNamePos, errorString.length)
			.split(" ")[2];

		return columnName.replace(/\'/g, "").split(".")[1];
	}

	return null;
}

export default { dbConnect, query, hasStringDuplicatedKeys, tableName };
