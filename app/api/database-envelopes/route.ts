import { NextRequest } from "next/server";

process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";
process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";

const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECTION_STRING,
};

function formatDateForOracle(dateStr: string) {
  const [year, month, day] = dateStr.split("-");
  return `${day}/${month}/${year}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const oracledb = require("oracledb");

  const fromParam = searchParams.get("from_date");
  const toParam = searchParams.get("to_date");
  const statusParam = searchParams.get("status");
  const responsavelParam = searchParams.get("responsavel");

  const binds: Record<string, any> = {};
  let sql = `
      SELECT
        envelope_id,
        status,
        email_subject,
        responsavel_email,
        responsavel_nome,
        created_at,
        completed_at
      FROM DOCUSIGN_ENVELOPES
      WHERE 1=1
    `;

  if (fromParam && fromParam.trim() !== "") {
    sql += ` AND created_at >= TO_DATE(:from_date, 'DD/MM/YYYY')`;
    binds.from_date = {
      val: formatDateForOracle(fromParam),
      type: oracledb.STRING,
    };
  }

  if (toParam && toParam.trim() !== "") {
    sql += ` AND created_at <= TO_DATE(:to_date, 'DD/MM/YYYY')`;
    binds.to_date = {
      val: formatDateForOracle(toParam),
      type: oracledb.STRING,
    };
  }

  if (statusParam && statusParam.trim() !== "") {
    sql += ` AND LOWER(status) LIKE '%' || LOWER(:status) || '%'`;
    binds.status = { val: statusParam, type: oracledb.STRING };
  }

  if (responsavelParam && responsavelParam.trim() !== "") {
    sql += ` AND LOWER(responsavel_nome) LIKE '%' || LOWER(:responsavel) || '%'`;
    binds.responsavel = { val: responsavelParam, type: oracledb.STRING };
  }

  sql += ` ORDER BY created_at DESC`;

  try {
    const connection = await oracledb.getConnection(dbConfig);

    console.log("SQL:", sql);
    console.log("BINDS:", binds);

    const result = await connection.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    await connection.close();

    return new Response(JSON.stringify(result.rows), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Erro ao consultar o banco:", error);
    return new Response(
      JSON.stringify({ error: "Erro ao consultar banco", details: error.message }),
      { status: 500 }
    );
  }
}
