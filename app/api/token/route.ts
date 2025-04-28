import { NextResponse } from "next/server";
import { generateToken } from "@/lib/docusign/token";

export async function GET() {
  try {
    const token = await generateToken();
    return NextResponse.json({ access_token: token });
  } catch (error: any) {
    console.error("Erro ao gerar token:", error.message);
    return NextResponse.json({ error: "Erro ao gerar token", details: error.message }, { status: 500 });
  }
}
