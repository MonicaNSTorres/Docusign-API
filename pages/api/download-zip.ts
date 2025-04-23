import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import JSZip from "jszip";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { from_date, to_date } = req.query;

  if (!from_date || !to_date) {
    return res.status(400).json({ error: "Parâmetros from_date e to_date são obrigatórios." });
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
      return res.status(404).json({ error: "Nenhum envelope encontrado no intervalo." });
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
      } catch (err) {
        console.error(`Erro ao baixar envelope ${env.envelopeId}:`, err.message);
      }
    }

    const zipContent = await zip.generateAsync({ type: "nodebuffer" });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="envelopes_${from_date}_a_${to_date}.zip"`);
    res.send(zipContent);
  } catch (error: any) {
    console.error("Erro no ZIP:", error.response?.data || error.message);
    res.status(500).json({ error: "Erro ao processar os envelopes", details: error.message });
  }
}
