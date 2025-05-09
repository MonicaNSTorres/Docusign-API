import { NextRequest } from "next/server";
import { getProgress } from "@/lib/progressStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fromDate = searchParams.get("from_date");
  const toDate = searchParams.get("to_date");

  if (!fromDate || !toDate) {
    return new Response("Parâmetros ausentes", { status: 400 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const interval = setInterval(() => {
        try {
          const progress = getProgress(fromDate, toDate);

          if (progress >= 100) {
            controller.enqueue(`data: ${JSON.stringify({ complete: true })}\n\n`);
            clearInterval(interval);
            controller.close();
          } else {
            controller.enqueue(`data: ${JSON.stringify({ progress })}\n\n`);
          }
        } catch (err) {
          console.error("Erro ao enviar dados via SSE:", err);
          clearInterval(interval);
          try {
            controller.close();
          } catch (_) {}
        }
      }, 300);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}