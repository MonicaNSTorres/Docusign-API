import { NextRequest } from "next/server";
import axios from "axios";
import JSZip from "jszip";

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
    const tokenRes = await axios.get("http://localhost:3000/api/token");
    const token = tokenRes.data.access_token;

    const envelopesRes = await axios.get(
      `https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes?from_date=${from_date}&to_date=${to_date}&status=completed`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    const envelopes = envelopesRes.data.envelopes || [];

    if (envelopes.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum envelope encontrado no intervalo." }), {
        status: 404,
      });
    }

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

        const filename = `${env.emailSubject?.replace(/[^\w\d]/g, "_") || "envelope"}_${env.envelopeId}.pdf`;
        zip.file(filename, pdf.data);
      } catch (err: any) {
        console.error(`Erro ao baixar envelope ${env.envelopeId}:`, err.message);
      }
    }

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    return new Response(zipContent, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="envelopes_${from_date}_a_${to_date}.zip"`,
      },
    });
  } catch (error: any) {
    console.error("Erro no ZIP:", error.response?.data || error.message);
    return new Response(JSON.stringify({ error: "Erro ao processar os envelopes", details: error.message }), {
      status: 500,
    });
  }
}
