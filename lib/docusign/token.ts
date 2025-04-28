import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";
import axios from "axios";

export async function generateToken(): Promise<string> {
  const privateKeyPath = path.join(process.cwd(), "keys", "private.key");
  const privateKey = fs.readFileSync(privateKeyPath, "utf8");

  const CLIENT_ID = process.env.DOCUSIGN_CLIENT_ID!;
  const USER_ID = process.env.DOCUSIGN_USER_ID!;
  const AUDIENCE = "account.docusign.com";
  const AUTH_URL = "https://account.docusign.com/oauth/token";

  const payload = {
    iss: CLIENT_ID,
    sub: USER_ID,
    aud: AUDIENCE,
    scope: "signature impersonation",
  };

  const jwtToken = jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1h",
  });

  const response = await axios.post(
    AUTH_URL,
    new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwtToken,
    }).toString(),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

  return response.data.access_token;
}