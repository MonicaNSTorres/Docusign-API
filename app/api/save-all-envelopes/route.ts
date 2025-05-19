process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";

import { NextRequest } from "next/server";
import axios from "axios";
import { generateToken } from "@/lib/docusign/token";
import pLimit from "p-limit";

async function registrarErro(connection: any, envelopeId: string, mensagemErro: string) {
  try {
    await connection.execute(
      `INSERT INTO DOCUSIGN_ERROS_DOWNLOAD (ENVELOPE_ID, MENSAGEM_ERRO)
       VALUES (:envelopeId, :mensagemErro)`,
      { envelopeId, mensagemErro },
      { autoCommit: true }
    );
  } catch (erroRegistro: any) {
    console.error(`Falha ao registrar erro no banco para envelope ${envelopeId}:`, erroRegistro.message || erroRegistro);
  }
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  try {
    const token = await generateToken();
    const accountId = "3d5e52ce-6726-43ea-96ef-5829b5394faa";
    const pageSize = 1000;
    let startPosition = 0;
    let allEnvelopes: any[] = [];

    const from_date = "2024-05-01";
    const to_date = "2024-05-31";

    console.log("Buscando envelopes de:", from_date, "até", to_date);

    while (true) {
      const url = `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes?from_date=${from_date}&to_date=${to_date}&status=any&start_position=${startPosition + 1}&count=${pageSize}`;

      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
        timeout: 60000,
      });

      const envelopes = res.data.envelopes || [];
      if (envelopes.length === 0) break;

      allEnvelopes = allEnvelopes.concat(envelopes);
      startPosition += pageSize;
      if (envelopes.length < pageSize) break;

      await delay(200);
    }

    console.log(`\nTotal de envelopes: ${allEnvelopes.length}`);
    if (allEnvelopes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum envelope encontrado." }), { status: 404 });
    }

    const oracledb = require("oracledb");
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
    });

    let currentToken = token;
    let counter = 0;
    const commitThreshold = 100;
    const limit = pLimit(5);

    const results = await Promise.allSettled(
      allEnvelopes.map((env: any) =>
        limit(async () => {
          let tentativas = 0;
          let sucesso = false;

          while (!sucesso && tentativas < 3) {
            try {
              const pdf = await axios.get(
                `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes/${env.envelopeId}/documents/combined`,
                {
                  headers: { Authorization: `Bearer ${currentToken}` },
                  responseType: "arraybuffer",
                }
              );

              const contentType = pdf.headers["content-type"];
              if (contentType?.includes("application/json")) {
                const jsonString = Buffer.from(pdf.data).toString("utf-8");
                const jsonError = JSON.parse(jsonString);

                if (jsonError?.errorCode === "USER_AUTHENTICATION_FAILED") {
                  currentToken = await generateToken();
                  tentativas++;
                  continue;
                }

                await registrarErro(connection, env.envelopeId, JSON.stringify(jsonError));
                break;
              }

              const buffer = Buffer.from(pdf.data);

              await connection.execute(
                `MERGE INTO DOCUSIGN_ENVELOPES e
                 USING (SELECT :envelopeId AS envelopeId FROM dual) src
                 ON (e.ENVELOPE_ID = src.envelopeId)
                 WHEN MATCHED THEN
                   UPDATE SET STATUS = :status, COMPLETED_AT = :completedAt
                 WHEN NOT MATCHED THEN
                   INSERT (ENVELOPE_ID, STATUS, EMAIL_SUBJECT, CREATED_AT, COMPLETED_AT, RESPONSAVEL_EMAIL, RESPONSAVEL_NOME, DOCUMENTO)
                   VALUES (:envelopeId, :status, :subject, :createdAt, :completedAt, :email, :nome, :documento)`,
                {
                  envelopeId: env.envelopeId,
                  status: env.status,
                  subject: env.emailSubject,
                  createdAt: new Date(env.createdDateTime),
                  completedAt: new Date(env.completedDateTime),
                  email: env.sender.email,
                  nome: env.sender.userName,
                  documento: buffer,
                }
              );

              counter++;
              if (counter % commitThreshold === 0) {
                await connection.commit();
              }

              sucesso = true;
              process.stdout.write(`\rSalvos: ${counter}/${allEnvelopes.length}`);
            } catch (err: any) {
              tentativas++;
              await delay(500);

              const shouldLog = tentativas >= 3 || err.code === "ECONNRESET" || err.message?.includes("socket hang up");
              if (shouldLog) {
                await registrarErro(connection, env.envelopeId, err?.message || JSON.stringify(err));
                console.error(`Erro definitivo no envelope ${env.envelopeId}: ${err?.message || err}`);
                break;
              }
            }
          }
        })
      )
    );

    const failed = results.filter(r => r.status === "rejected");
    if (failed.length > 0) {
      console.error(`\n❌ ${failed.length} envelopes falharam ao salvar.`);
      failed.forEach((f: any, i) => console.error(`Erro ${i + 1}:`, f.reason));
    }

    await connection.commit();
    await connection.close();

    console.log("\nFinalizado com sucesso.");

    return new Response(JSON.stringify({ sucesso: true, total: allEnvelopes.length }), {
      status: 200,
    });
  } catch (error: any) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", detalhes: error.message }),
      { status: 500 }
    );
  }
}
