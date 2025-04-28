import { NextRequest } from "next/server";
import { generateToken } from "@/lib/docusign/token";
import { getOracleConnection } from "@/lib/db";
import axios from "axios";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from_date = searchParams.get("from_date");
  const to_date = searchParams.get("to_date");

  if (!from_date || !to_date) {
    return new Response(JSON.stringify({ error: "Parâmetros obrigatórios." }), { status: 400 });
  }

  try {
    const token = await generateToken();

    const envelopesRes = await axios.get(
      `https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes?from_date=${from_date}&to_date=${to_date}&status=completed`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const envelopes = envelopesRes.data.envelopes || [];

    const connection = await getOracleConnection();

    for (const env of envelopes) {
      try {
        const pdfRes = await axios.get(
          `https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes/${env.envelopeId}/documents/combined`,
          {
            headers: { Authorization: `Bearer ${token}` },
            responseType: "arraybuffer",
          }
        );

        const query = `
          MERGE INTO DOCUSIGN_ENVELOPES e
          USING (SELECT :envelopeId AS envelopeId FROM dual) d
          ON (e.ENVELOPE_ID = d.envelopeId)
          WHEN NOT MATCHED THEN
            INSERT (
              ENVELOPE_ID, STATUS, EMAIL_SUBJECT, CREATED_AT,
              COMPLETED_AT, RESPONSAVEL_EMAIL, RESPONSAVEL_NOME, DOCUMENTO
            )
            VALUES (
              :envelopeId, :status, :emailSubject, TO_TIMESTAMP(:created, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
              TO_TIMESTAMP(:completed, 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
              :responsavelEmail, :responsavelNome, :documento
            )
        `;

        await connection.execute(query, {
          envelopeId: env.envelopeId,
          status: env.status,
          emailSubject: env.emailSubject,
          created: env.createdDateTime,
          completed: env.completedDateTime,
          responsavelEmail: env.sender.email,
          responsavelNome: env.sender.userName,
          documento: pdfRes.data,
        }, { autoCommit: true });

      } catch (err) {
        console.error(`Erro ao salvar envelope ${env.envelopeId}`, err);
      }
    }

    await connection.close();
    return new Response(JSON.stringify({ ok: true, count: envelopes.length }), { status: 200 });

  } catch (error: any) {
    console.error("Erro na sincronização:", error.message);
    return new Response(JSON.stringify({ error: "Erro interno", details: error.message }), { status: 500 });
  }
}
