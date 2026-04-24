import { NextResponse } from "next/server";
import { getApiKeyQuota, setApiKeyQuota, resetApiKeyQuota, getApiKeyById } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// GET /api/keys/[id]/quota
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    const quota = await getApiKeyQuota(id);
    return NextResponse.json({ quota });
  } catch (error) {
    console.log("Error fetching quota:", error);
    return NextResponse.json({ error: "Failed to fetch quota" }, { status: 500 });
  }
}

// PUT /api/keys/[id]/quota — set/update quota
// allowed body fields: enabled (bool), limit (number), period ("daily"|"monthly"|"total")
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    let body = {};
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    if (body.enabled !== false && body.enabled !== undefined) {
      if (body.limit === undefined || !Number.isFinite(Number(body.limit)) || Number(body.limit) <= 0) {
        return NextResponse.json({ error: "limit must be a positive number when quota is enabled" }, { status: 400 });
      }
    }
    if (body.period && !["daily", "monthly", "total"].includes(body.period)) {
      return NextResponse.json({ error: "period must be one of: daily, monthly, total" }, { status: 400 });
    }

    const quota = await setApiKeyQuota(id, body);
    return NextResponse.json({ quota });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("limit must be") || error.message.includes("period must be"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.log("Error setting quota:", error);
    return NextResponse.json({ error: "Failed to set quota" }, { status: 500 });
  }
}

// POST /api/keys/[id]/quota/reset — reset quota usage counters
export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const quota = await resetApiKeyQuota(id);
    return NextResponse.json({ quota, message: "Quota usage reset successfully" });
  } catch (error) {
    console.log("Error resetting quota:", error);
    return NextResponse.json({ error: "Failed to reset quota" }, { status: 500 });
  }
}
