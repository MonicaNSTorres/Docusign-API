import oracledb from "oracledb";
import dotenv from "dotenv";

dotenv.config();

export async function GET() {
  try {
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
    });

    console.log("Conectado com sucesso!");
    await connection.close();

    return new Response("Conexão OK!", { status: 200 });
  } catch (err) {
    console.error("Erro de conexão:", err);
    return new Response("Erro interno no servidor", { status: 500 });
  }
}
