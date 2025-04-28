process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";

import { NextRequest } from "next/server";
import { generateToken } from "@/lib/docusign/token";
import axios from "axios";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from_date = searchParams.get("from_date") || "2024-01-01";
  const to_date = searchParams.get("to_date") || new Date().toISOString().split("T")[0];

  try {
    const token = await generateToken();
    const accountId = "3d5e52ce-6726-43ea-96ef-5829b5394faa";

    const res = await axios.get(
      `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes?from_date=${from_date}&to_date=${to_date}&status=any`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    return new Response(JSON.stringify({ envelopes: res.data.envelopes }), { status: 200 });
  } catch (error: any) {
    console.error("Erro ao buscar envelopes:", error.response?.data || error.message);
    return new Response(JSON.stringify({ error: "Erro ao buscar envelopes" }), { status: 500 });
  }
}
