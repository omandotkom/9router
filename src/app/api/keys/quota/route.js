import { NextResponse } from "next/server";
import { getApiKeys, getApiKeyQuota } from "@/lib/localDb";

export const dynamic = "force-dynamic";

// GET /api/keys/quota — list all keys with their quota status
export async function GET() {
  try {
    const keys = await getApiKeys();
    const result = await Promise.all(
      keys.map(async (key) => {
        const quota = await getApiKeyQuota(key.id);
        return {
          id: key.id,
          name: key.name,
          key: key.key,
          isActive: key.isActive,
          createdAt: key.createdAt,
          quota: quota || {
            enabled: false,
            limit: 0,
            period: null,
            resetAt: null,
            usedTokens: 0,
            remainingTokens: null,
          },
        };
      })
    );
    return NextResponse.json({ keys: result });
  } catch (error) {
    console.error("Error fetching keys quota:", error);
    return NextResponse.json({ error: "Failed to fetch keys" }, { status: 500 });
  }
}
