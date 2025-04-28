process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";


import { NextRequest } from "next/server";
import axios from "axios";
import JSZip from "jszip";
import { generateToken } from "@/lib/docusign/token";
import oracledb from "oracledb";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from_date = searchParams.get("from_date");
  const to_date = searchParams.get("to_date");

  if (!from_date || !to_date) {
    return new Response(JSON.stringify({ error: "Parâmetros from_date e to_date são obrigatórios." }), {
      status: 400,
    });
  }

  try {
    const token = await generateToken();

    const envelopesRes = await axios.get(
      `https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes?from_date=${from_date}&to_date=${to_date}&status=any`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const envelopes = envelopesRes.data.envelopes || [];

    if (envelopes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum envelope encontrado." }), { status: 404 });
    }

    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
    });

    const zip = new JSZip();

    for (const env of envelopes) {
      try {
        const pdf = await axios.get(
          `https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes/${env.envelopeId}/documents/combined`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: "arraybuffer",
          }
        );

        const contentType = pdf.headers["content-type"];
        if (contentType && contentType.includes("application/json")) {
          const jsonString = Buffer.from(pdf.data).toString("utf-8");
          const jsonError = JSON.parse(jsonString);
          console.error(`Erro da API DocuSign no envelope ${env.envelopeId}:`, jsonError);
          continue;
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

        console.log(`Envelope ${env.envelopeId} salvo com sucesso. Data criação: ${env.createdAt}`);
      } catch (err: any) {
        console.error("Erro ao processar envelope:", err?.response?.data || err?.message || err);
      }
    }


    await connection.close();

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(zipContent, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="envelopes_${from_date}_a_${to_date}.zip"`,
      },
    });
  } catch (error: any) {
    console.error("Erro interno no download ZIP:", {
      message: error?.message,
      response: error?.response?.data,
      stack: error?.stack,
      erroCru: error
    });

    return new Response(
      JSON.stringify({ error: "Erro interno", details: error?.message || "Erro desconhecido" }),
      { status: 500 }
    );
  }
}