process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";

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

    let allEnvelopes: any[] = [];
    let startPosition = 0;
    const pageSize = 100;

    while (true) {
      const url = `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes?from_date=${from_date}&to_date=${to_date}&status=any&include=recipients,folders&start_position=${startPosition + 1}&count=${pageSize}`;
      console.log(`➡️ Buscando página a partir de ${startPosition + 1}`);

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

      if (envelopes.length < pageSize) break; // última página
    }

    console.log("✅ Total final:", allEnvelopes.length);

    return new Response(JSON.stringify({ envelopes: allEnvelopes }), { status: 200 });
  } catch (error: any) {
    const erroCru = error.response?.data || error.message;
    console.error("❌ ERRO no backend /api/envelopes:", erroCru);
    return new Response(JSON.stringify({ error: "Erro ao buscar envelopes", erroCru }), { status: 500 });
  }
}
