process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";
process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";

import { NextRequest } from "next/server";
import oracledb from "oracledb";

const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECTION_STRING,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from_date = searchParams.get("from_date") || null;
  const to_date = searchParams.get("to_date") || null;
  const status = searchParams.get("status") || null;
  const responsavel = searchParams.get("responsavel") || null;

  try {
    const connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `
      SELECT 
        envelope_id, 
        status, 
        email_subject, 
        responsavel_email, 
        responsavel_nome,
        TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS created_at,
        TO_CHAR(completed_at, 'YYYY-MM-DD"T"HH24:MI:SS') AS completed_at
      WHERE (:from_date IS NULL OR created_at >= TO_DATE(:from_date, 'YYYY-MM-DD'))
        AND (:to_date IS NULL OR created_at <= TO_DATE(:to_date, 'YYYY-MM-DD'))
        AND (:status IS NULL OR LOWER(status) LIKE '%' || LOWER(:status) || '%')
        AND (:responsavel IS NULL OR LOWER(responsavel_nome) LIKE '%' || LOWER(:responsavel) || '%')
      ORDER BY created_at DESC
      `,
      { from_date, to_date, status, responsavel },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    await connection.close();

    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro ao consultar Oracle:", error);
    return new Response(JSON.stringify({ error: "Erro ao consultar banco", details: error.message }), {
      status: 500,
    });
  }
}
