process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";

import { NextRequest } from "next/server";

const dbConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECTION_STRING,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const envelopeId = searchParams.get("envelopeId");
  const inline = searchParams.get("inline") === "true";

  if (!envelopeId) {
    return new Response(JSON.stringify({ error: "envelopeId é obrigatório" }), { status: 400 });
  }

  try {
    const oracledb = require("oracledb");
    const connection = await oracledb.getConnection(dbConfig);

    const result = await connection.execute(
      `SELECT DOCUMENTO FROM DOCUSIGN_ENVELOPES WHERE ENVELOPE_ID = :envelopeId`,
      [envelopeId],
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
        fetchInfo: { DOCUMENTO: { type: oracledb.BUFFER } },
      }
    );

    await connection.close();

    const rows = result.rows as { DOCUMENTO: Buffer }[];

    if (!rows || rows.length === 0 || !rows[0].DOCUMENTO) {
      return new Response(JSON.stringify({ error: "PDF não encontrado no banco" }), { status: 404 });
    }

    const pdfBuffer = rows[0].DOCUMENTO;

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${envelopeId}.pdf"`, // 👈 AQUI
      },
    });
  } catch (error: any) {
    console.error("Erro ao buscar PDF no banco:", error);
    return new Response(JSON.stringify({ error: "Erro interno", details: error.message }), { status: 500 });
  }
}
