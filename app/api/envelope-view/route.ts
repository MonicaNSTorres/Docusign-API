import { NextRequest } from "next/server";
import axios from "axios";
import { generateToken } from "@/lib/docusign/token";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const envelopeId = searchParams.get("envelopeId");

  if (!envelopeId) {
    return new Response(JSON.stringify({ error: "Envelope ID ausente" }), {
      status: 400,
    });
  }

  try {
    const token = await generateToken();

    const viewRequest = {
      returnUrl: "https://localhost:3001", // ajuste para sua URL final de "voltar"
      authenticationMethod: "none",
      userName: "Seu Nome", // pode ser dinâmico
      email: "seu@email.com", // deve ser o mesmo do signatário
      recipientId: "1", // normalmente é "1", se for o primeiro destinatário
    };

    const accountId = "3d5e52ce-6726-43ea-96ef-5829b5394faa";
    const baseUrl = "https://na3.docusign.net";

    const result = await axios.post(
      `${baseUrl}/restapi/v2.1/accounts/${accountId}/envelopes/${envelopeId}/views/recipient`,
      viewRequest,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );

    return Response.redirect(result.data.url, 302);
  } catch (error: any) {
    console.error("Erro ao gerar URL incorporada:", error.response?.data || error.message);
    return new Response(
      JSON.stringify({ error: "Erro ao gerar visualização", details: error.message }),
      { status: 500 }
    );
  }
}
