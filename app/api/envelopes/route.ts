process.env.NODE_ORACLEDB_DISABLE_AZURE_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OCI_CONFIG = "true";
process.env.NODE_ORACLEDB_DISABLE_OAUTH_TOKEN = "true";

import { NextRequest } from "next/server";
import { generateToken } from "@/lib/docusign/token";
import axios from "axios";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from_date");
  const toParam = searchParams.get("to_date");

  const from_date = fromParam ? `${fromParam}T00:00:00` : new Date().getFullYear() + "-01-01T00:00:00";
  const to_date = toParam ? `${toParam}T23:59:59` : new Date().toISOString().split("T")[0] + "T23:59:59";

  const statusParam = searchParams.get("status");
  const statusFilter = statusParam && statusParam.trim().toLowerCase() !== "any" ? statusParam : null;

  const responsavelParam = searchParams.get("responsavel") || null;

  try {
    const token = await generateToken();
    const accountId = "3d5e52ce-6726-43ea-96ef-5829b5394faa";

    const pageSize = 100;
    const maxPages = 120; //120 × 100 = 12.000
    let allEnvelopes: any[] = [];
    let startPosition = 0;
    let currentPage = 1;

    const oracledb = require("oracledb");
    const connection = await oracledb.getConnection({
      user: process.env.ORACLE_USER,
      password: process.env.ORACLE_PASSWORD,
      connectString: process.env.ORACLE_CONNECTION_STRING,
    });

    while (currentPage <= maxPages) {
      //const url = `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes?from_date=${from_date}&to_date=${to_date}&status=any&include=recipients,folders&start_position=${startPosition + 1}&count=${pageSize}`;
      const url = `https://na3.docusign.net/restapi/v2.1/accounts/${accountId}/envelopes?from_date=${from_date}&to_date=${to_date}&status=any&include=recipients,folders&start_position=${startPosition + 1}&count=${pageSize}`;
      console.log(`Buscando página ${currentPage}, início em ${startPosition + 1}`);

      try {
        const res = await axios.get(url, {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 30000,
        });

        const envelopes = res.data.envelopes || [];
        allEnvelopes = allEnvelopes.concat(envelopes);
        if (envelopes.length < pageSize) break;

        startPosition += pageSize;
        currentPage++;
        await new Promise((resolve) => setTimeout(resolve, 300)); //evita sobrecarga

      } catch (err: any) {
        console.error(`Erro ao buscar página ${currentPage}:`, err.message);

        await connection.execute(
          `INSERT INTO DOCUSIGN_ERROS_DOWNLOAD (ENVELOPE_ID, MENSAGEM_ERRO)
       VALUES (:envelopeId, :mensagemErro)`,
          {
            envelopeId: `pagina_${currentPage}_start_${startPosition + 1}`,
            mensagemErro: err.message || JSON.stringify(err),
          },
          { autoCommit: true }
        );

        await connection.close();
        break; //interrompe a execucao depois do erro
      }
    }

    const uniqueEnvelopesMap = new Map();
    allEnvelopes.forEach(env => {
      uniqueEnvelopesMap.set(env.envelopeId, env);
    });
    let uniqueEnvelopes = Array.from(uniqueEnvelopesMap.values());

    if (statusParam || responsavelParam) {
      uniqueEnvelopes = uniqueEnvelopes.filter((env: any) => {
        const statusOk = !statusFilter || env.status?.toLowerCase().includes(statusFilter.toLowerCase());
        const responsavelOk = !responsavelParam || env.sender?.userName?.toLowerCase().includes(responsavelParam.toLowerCase());
        return statusOk && responsavelOk;
      });
    }

    console.log("🔍 Total único filtrado:", uniqueEnvelopes.length);

    return new Response(JSON.stringify({ envelopes: uniqueEnvelopes }), { status: 200 });

  } catch (error: any) {
    console.error("❌ ERRO COMPLETO:", error);
    const erroCru = error.response?.data || error.message;
    console.error("❌ ERRO no backend /api/envelopes:", erroCru);

    return new Response(JSON.stringify({ error: "Erro ao buscar envelopes", erroCru }), { status: 500 });
  }
}