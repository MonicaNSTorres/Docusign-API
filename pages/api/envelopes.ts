import axios from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const tokenRes = await axios.get("http://localhost:3000/api/token");
    const token = tokenRes.data.access_token;

    const response = await axios.get(
      "https://na3.docusign.net/restapi/v2.1/accounts/3d5e52ce-6726-43ea-96ef-5829b5394faa/envelopes?from_date=2025-01-01&status=completed",
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      }
    );

    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Erro envelopes:", error.response?.data || error.message);
    return res.status(500).json({
      error: "Erro ao buscar envelopes",
      details: error.response?.data || error.message,
    });
  }
}
