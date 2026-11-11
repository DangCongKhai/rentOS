import { NextResponse } from "next/server";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export async function GET() {
  try {
    const response = await fetch(`${apiUrl}/api/health`, { cache: "no-store" });
    const body: unknown = await response.json();

    return NextResponse.json(
      { ok: response.ok, apiUrl, body },
      { status: response.ok ? 200 : 502 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        apiUrl,
        error: error instanceof Error ? error.message : "Request failed.",
      },
      { status: 502 },
    );
  }
}
