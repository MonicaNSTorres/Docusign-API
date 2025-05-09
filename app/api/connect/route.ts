process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";

import dotenv from "dotenv";

dotenv.config();

export async function GET() {
  try {
    const oracledb = require("oracledb");
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
