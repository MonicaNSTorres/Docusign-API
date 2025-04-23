import axios from "axios";
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(401).json({ error: "Token JWT ausente no header Authorization." });
    }

    const response = await axios.get("https://account.docusign.com/oauth/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    return res.status(500).json({ error: "Erro ao buscar dados do userinfo"/*, details: erro?.data || error.message*/ });
  }
}
