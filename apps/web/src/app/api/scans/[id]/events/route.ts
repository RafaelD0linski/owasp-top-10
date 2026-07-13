import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { subscribeScan } from "@/lib/orchestrator";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { id } = await params;
  const scan = await prisma.scan.findFirst({
    where: { id, userId: user.id },
  });
  if (!scan) {
    return new Response("Not found", { status: 404 });
  }

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      send({ type: "connected", scanId: id, status: scan.status });

      // Replay past events
      void prisma.scanEvent
        .findMany({
          where: { scanId: id },
          orderBy: { createdAt: "asc" },
        })
        .then((events) => {
          for (const e of events) {
            send({
              type: e.type,
              checkId: e.checkId,
              owaspId: e.owaspId,
              checkName: e.checkName,
              message: e.message,
              findings: e.payload ? JSON.parse(e.payload) : undefined,
              at: e.createdAt.toISOString(),
              replay: true,
            });
          }
        });

      const unsubscribe = subscribeScan(id, (event) => {
        send(event);
        if (event.type === "scan_done" || event.type === "scan_error") {
          // keep connection briefly then close
          setTimeout(() => {
            if (!closed) {
              closed = true;
              unsubscribe();
              try {
                controller.close();
              } catch {
                // ignore
              }
            }
          }, 500);
        }
      });

      const heartbeat = setInterval(() => {
        if (closed) return;
        controller.enqueue(encoder.encode(`: ping\n\n`));
      }, 15000);

      req.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // ignore
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
