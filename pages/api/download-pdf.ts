import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { envelopeId } = req.query;

  if (!envelopeId) {
    return res.status(400).json({ error: "envelopeId ausente" });
  }

  try {
    const tokenRes = await axios.get("http://localhost:3000/api/token");
    const token = tokenRes.data.access_token;

    const pdfResponse = await axios.get(
      `https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes/${envelopeId}/documents/combined`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/pdf",
        },
        responseType: "arraybuffer",
      }
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="${envelopeId}.pdf"`);
    res.send(pdfResponse.data);
  } catch (error: any) {
    console.error("Erro ao baixar PDF:", error.response?.data || error.message);
    res.status(500).json({
      error: "Erro ao baixar PDF",
      details: error.response?.data || error.message,
    });
  }
}
