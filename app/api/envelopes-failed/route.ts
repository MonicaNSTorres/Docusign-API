process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";

import { NextRequest } from "next/server";
import axios from "axios";
import { generateToken } from "@/lib/docusign/token";

export async function GET(req: NextRequest) {
  try {
    const token = await generateToken();
    const accountId = "3d5e52ce-6726-43ea-96ef-5829b5394faa";

    const oracledb = require("oracledb");
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
    });

    const { rows: erros } = await connection.execute(
      `SELECT DISTINCT ENVELOPE_ID FROM DOCUSIGN_ERROS_DOWNLOAD WHERE ENVELOPE_ID IS NOT NULL`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (!erros.length) {
      return new Response(JSON.stringify({ mensagem: "Nenhum envelope com erro encontrado." }), { status: 200 });
    }

    let sucesso = 0;
    let falhas = 0;
    let currentToken = token;
    const commitInterval = 20;
    let updatesSinceLastCommit = 0;

    for (const row of erros) {
      const envelopeId = row.ENVELOPE_ID;
      let tentativas = 0;

      while (tentativas < 3) {
        try {
          const pdf = await axios.get(
            `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/documents/combined`,
            {
              headers: { Authorization: `Bearer ${currentToken}` },
              responseType: "arraybuffer",
            }
          );

          const contentType = pdf.headers["content-type"];
          if (contentType?.includes("application/json")) {
            const jsonError = JSON.parse(Buffer.from(pdf.data).toString("utf-8"));

            if (jsonError?.errorCode === "USER_AUTHENTICATION_FAILED") {
              currentToken = await generateToken();
              tentativas++;
              continue;
            }

            throw new Error(jsonError.message || "Erro desconhecido da DocuSign.");
          }

          const buffer = Buffer.from(pdf.data);

          await connection.execute(
            `UPDATE DOCUSIGN_ENVELOPES SET DOCUMENTO = :documento WHERE ENVELOPE_ID = :envelopeId`,
            { documento: buffer, envelopeId }
          );

          await connection.execute(
            `DELETE FROM DOCUSIGN_ERROS_DOWNLOAD WHERE ENVELOPE_ID = :envelopeId`,
            { envelopeId }
          );

          sucesso++;
          updatesSinceLastCommit++;

          if (updatesSinceLastCommit >= commitInterval) {
            await connection.commit();
            updatesSinceLastCommit = 0;
          }

          process.stdout.write(`\r✅ Salvos: ${sucesso}/${erros.length}`);
          break;
        } catch (err: any) {
          tentativas++;
          if (tentativas >= 3) {
            const msg = err?.message || JSON.stringify(err);
            console.error(`Erro definitivo do envelope ${envelopeId || "desconhecido"}: ${msg}`);
            falhas++;
          }
        }
      }
    }

    if (updatesSinceLastCommit > 0) {
      await connection.commit(); //garante commit final
    }

    await connection.close();

    return new Response(JSON.stringify({ sucesso, falhas }), {
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro geral no retry:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno no retry", detalhes: error.message }),
      { status: 500 }
    );
  }
}
