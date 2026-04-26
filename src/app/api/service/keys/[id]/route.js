import { deleteApiKey, getApiKeyById, getApiKeyQuota, updateApiKey } from "@/lib/localDb";
import {
  isServiceAuthorized,
  serviceCorsResponse,
  serviceUnauthorizedResponse,
  serviceJson,
} from "@/lib/serviceApiAuth";

export const dynamic = "force-dynamic";

function sanitizeApiKeyRecord(record, quota) {
  return {
    id: record.id,
    name: record.name,
    machineId: record.machineId,
    isActive: record.isActive !== false,
    createdAt: record.createdAt,
    usage: record.usage || { usedTokens: 0, lastResetAt: null },
    quota: quota || record.quota || { enabled: false, limit: 100000, period: "monthly", resetAt: null },
    keyMasked: typeof record.key === "string" ? `${record.key.slice(0, 12)}...` : null,
  };
}

function parseHardDelete(searchParams) {
  const value = (searchParams.get("hard") || "").trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

export async function OPTIONS(request) {
  return serviceCorsResponse(request, ["GET", "PATCH", "DELETE", "OPTIONS"]);
}

export async function GET(request, { params }) {
  if (!isServiceAuthorized(request)) {
    return serviceUnauthorizedResponse(request, "Invalid service token");
  }

  try {
    const { id } = await params;
    const key = await getApiKeyById(id);
    if (!key) {
      return serviceJson(request, { error: "API key not found" }, { status: 404 });
    }

    const quota = await getApiKeyQuota(id);
    return serviceJson(request, { key: sanitizeApiKeyRecord(key, quota) });
  } catch (error) {
    console.error("[Service API] Failed to fetch API key:", error);
    return serviceJson(request, { error: "Failed to fetch API key" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  if (!isServiceAuthorized(request)) {
    return serviceUnauthorizedResponse(request, "Invalid service token");
  }

  try {
    const { id } = await params;
    const body = await request.json();

    if (typeof body?.isActive !== "boolean") {
      return serviceJson(request, { error: "isActive (boolean) is required" }, { status: 400 });
    }

    const existing = await getApiKeyById(id);
    if (!existing) {
      return serviceJson(request, { error: "API key not found" }, { status: 404 });
    }

    const updated = await updateApiKey(id, { isActive: body.isActive });
    const quota = await getApiKeyQuota(id);

    return serviceJson(request, {
      key: sanitizeApiKeyRecord(updated, quota),
      message: body.isActive ? "API key activated" : "API key deactivated",
    });
  } catch (error) {
    console.error("[Service API] Failed to update API key:", error);
    return serviceJson(request, { error: "Failed to update API key" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  if (!isServiceAuthorized(request)) {
    return serviceUnauthorizedResponse(request, "Invalid service token");
  }

  try {
    const { id } = await params;
    const existing = await getApiKeyById(id);
    if (!existing) {
      return serviceJson(request, { error: "API key not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const hardDelete = parseHardDelete(searchParams);

    if (hardDelete) {
      await deleteApiKey(id);
      return serviceJson(request, { message: "API key hard deleted" });
    }

    const updated = await updateApiKey(id, { isActive: false });
    const quota = await getApiKeyQuota(id);
    return serviceJson(request, {
      key: sanitizeApiKeyRecord(updated, quota),
      message: "API key deactivated",
    });
  } catch (error) {
    console.error("[Service API] Failed to delete API key:", error);
    return serviceJson(request, { error: "Failed to delete API key" }, { status: 500 });
  }
}