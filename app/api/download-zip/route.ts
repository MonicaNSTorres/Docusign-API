process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";

import { NextRequest } from "next/server";
import axios from "axios";
import JSZip from "jszip";
import { generateToken } from "@/lib/docusign/token";
import { setProgress } from "@/lib/progressStore";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from_date = searchParams.get("from_date");
  const to_date = searchParams.get("to_date");

  if (!from_date || !to_date) {
    return new Response(JSON.stringify({ error: "Parâmetros from_date e to_date são obrigatórios." }), {
      status: 400,
    });
  }

  const diffDias = (new Date(to_date).getTime() - new Date(from_date).getTime()) / (1000 * 60 * 60 * 24);
  if (diffDias > 61) {
    return new Response(JSON.stringify({ error: "Selecione um intervalo de até 2 meses por vez para o download." }), {
      status: 400,
    });
  }

  try {
    const token = await generateToken();
    const accountId = "3d5e52ce-6726-43ea-96ef-5829b5394faa";
    const pageSize = 100;
    let startPosition = 0;
    let allEnvelopes: any[] = [];

    while (true) {
      const url = `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes?from_date=${from_date}&to_date=${to_date}&status=any&start_position=${startPosition + 1}&count=${pageSize}`;
      const res = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      const envelopes = res.data.envelopes || [];
      if (envelopes.length === 0) break;

      allEnvelopes = allEnvelopes.concat(envelopes);
      startPosition += pageSize;
      if (envelopes.length < pageSize) break;

      await delay(300);
    }

    if (allEnvelopes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum envelope encontrado." }), { status: 404 });
    }

    const oracledb = require("oracledb");
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
    });

    const zip = new JSZip();

    for (let i = 0; i < allEnvelopes.length; i++) {
      const env = allEnvelopes[i];
      let currentToken = await generateToken();
      let tentativas = 0;
      let sucesso = false;

      while (!sucesso && tentativas < 2) {
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

            console.error(`Erro da API DocuSign no envelope ${env.envelopeId}:`, jsonError);
            break;
          }

          const buffer = Buffer.from(pdf.data);
          const filename = `${env.emailSubject?.replace(/[^\w\d]/g, "_") || "envelope"}_${env.envelopeId}.pdf`;
          zip.file(filename, buffer);

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
            },
            { autoCommit: true }
          );

          sucesso = true;

          const percent = Math.round(((i + 1) / allEnvelopes.length) * 100);
          setProgress(from_date, to_date, percent);

        } catch (err: any) {
          console.error(`Erro ao processar envelope ${env.envelopeId}:`, err?.message || err);
          break;
        }
      }
    }

    await connection.close();

    setProgress(from_date, to_date, 100);

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(zipContent, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="envelopes_${from_date}_a_${to_date}.zip"`,
      },
    });

  } catch (error: any) {
    console.error("Erro interno no download ZIP:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: error?.message || "Erro desconhecido" }),
      { status: 500 }
    );
  }
}
