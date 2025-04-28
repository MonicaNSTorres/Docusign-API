import { NextRequest } from "next/server";
import axios from "axios";
import { generateToken } from "@/lib/docusign/token";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const envelopeId = searchParams.get("envelopeId");

  if (!envelopeId) {
    return new Response(JSON.stringify({ error: "Parâmetro envelopeId obrigatório." }), {
      status: 400,
    });
  }

  try {
    const token = await generateToken();

    const pdfRes = await axios.get(
      `https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes/${envelopeId}/documents/combined`,
      {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "arraybuffer",
      }
    );

    return new Response(pdfRes.data, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${envelopeId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Erro ao baixar PDF:", error.response?.data || error.message);
    return new Response(JSON.stringify({ error: "Erro ao baixar PDF" }), {
      status: 500,
    });
  }
}
