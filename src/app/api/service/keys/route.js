import { createApiKey, getApiKeys, getApiKeyQuota, setApiKeyQuota } from "@/lib/localDb";
import { getConsistentMachineId } from "@/shared/utils/machineId";
import {
  isServiceAuthorized,
  serviceCorsResponse,
  serviceUnauthorizedResponse,
  serviceJson,
} from "@/lib/serviceApiAuth";

export const dynamic = "force-dynamic";

function sanitizeApiKeyRecord(record) {
  return {
    id: record.id,
    name: record.name,
    machineId: record.machineId,
    isActive: record.isActive !== false,
    createdAt: record.createdAt,
    usage: record.usage || { usedTokens: 0, lastResetAt: null },
    quota: record.quota || { enabled: false, limit: 100000, period: "monthly", resetAt: null },
    keyMasked: typeof record.key === "string" ? `${record.key.slice(0, 12)}...` : null,
  };
}

function normalizeName(name) {
  if (typeof name !== "string") return "";
  return name.trim();
}

function isQuotaValidationError(message) {
  return message === "limit must be a positive number" || message === "period must be one of: daily, monthly, total";
}

export async function OPTIONS(request) {
  return serviceCorsResponse(request, ["GET", "POST", "OPTIONS"]);
}

export async function GET(request) {
  if (!isServiceAuthorized(request)) {
    return serviceUnauthorizedResponse(request, "Invalid service token");
  }

  try {
    const keys = await getApiKeys();
    const payload = keys.map(sanitizeApiKeyRecord);
    return serviceJson(request, { keys: payload });
  } catch (error) {
    console.error("[Service API] Failed to list API keys:", error);
    return serviceJson(request, { error: "Failed to list API keys" }, { status: 500 });
  }
}

export async function POST(request) {
  if (!isServiceAuthorized(request)) {
    return serviceUnauthorizedResponse(request, "Invalid service token");
  }

  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return serviceJson(request, { error: "Invalid JSON body" }, { status: 400 });
    }

    const name = normalizeName(body?.name);

    if (!name) {
      return serviceJson(request, { error: "name is required" }, { status: 400 });
    }

    const machineId = await getConsistentMachineId();
    const created = await createApiKey(name, machineId);

    if (body?.quota && typeof body.quota === "object") {
      await setApiKeyQuota(created.id, body.quota);
    }

    const quota = await getApiKeyQuota(created.id);

    return serviceJson(
      request,
      {
        id: created.id,
        name: created.name,
        key: created.key,
        machineId: created.machineId,
        createdAt: created.createdAt,
        isActive: created.isActive !== false,
        quota,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("[Service API] Failed to create API key:", error);

    const message = error?.message || "Failed to create API key";
    if (isQuotaValidationError(message)) {
      return serviceJson(request, { error: message }, { status: 400 });
    }

    return serviceJson(request, { error: message }, { status: 500 });
  }
}