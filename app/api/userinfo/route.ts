import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { generateToken } from "@/lib/docusign/token";

export async function GET(req: NextRequest) {
  try {
    const token = await generateToken();

    const response = await axios.get("https://account.docusign.com/oauth/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    return NextResponse.json(response.data);
  } catch (error: any) {
    console.error("Erro ao buscar userinfo:", error.message);
    return NextResponse.json(
      { error: "Erro ao buscar userinfo", details: error.message },
      { status: 500 }
    );
  }
}
