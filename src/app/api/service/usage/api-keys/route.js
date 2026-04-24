import { getApiKeys } from "@/lib/localDb";
import { getUsageStats } from "@/lib/usageDb";
import {
  isServiceAuthorized,
  serviceCorsResponse,
  serviceUnauthorizedResponse,
  serviceJson,
} from "@/lib/serviceApiAuth";

export const dynamic = "force-dynamic";

const VALID_PERIODS = new Set(["24h", "7d", "30d", "60d", "all"]);

function buildApiKeyMaps(keys) {
  const byValue = new Map();
  const byId = new Map();

  for (const key of keys) {
    byValue.set(key.key, key);
    byId.set(key.id, key);
  }

  return { byValue, byId };
}

function emptyMetric(record) {
  const isKnown = !!record;
  return {
    apiKeyId: record?.id || null,
    name: record?.name || "Unknown API Key",
    isActive: record ? record.isActive !== false : false,
    createdAt: record?.createdAt || null,
    keyMasked: record?.key ? `${record.key.slice(0, 12)}...` : null,
    totalRequests: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalEstimatedCost: 0,
    foundInUsage: false,
    knownKey: isKnown,
  };
}

function resolveFilterValue(searchParams, maps) {
  const apiKeyId = searchParams.get("apiKeyId");
  const apiKey = searchParams.get("apiKey");

  if (apiKeyId) {
    return maps.byId.get(apiKeyId) || null;
  }
  if (apiKey) {
    return maps.byValue.get(apiKey) || null;
  }
  return undefined;
}

export async function OPTIONS(request) {
  return serviceCorsResponse(request, ["GET", "OPTIONS"]);
}

export async function GET(request) {
  if (!isServiceAuthorized(request)) {
    return serviceUnauthorizedResponse(request, "Invalid service token");
  }

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "7d";
    if (!VALID_PERIODS.has(period)) {
      return serviceJson(request, { error: "Invalid period" }, { status: 400 });
    }

    const [usageStats, keys] = await Promise.all([
      getUsageStats(period),
      getApiKeys(),
    ]);

    const maps = buildApiKeyMaps(keys);
    const aggregated = new Map();

    for (const item of Object.values(usageStats.byApiKey || {})) {
      if (!item?.apiKey || typeof item.apiKey !== "string") continue;

      const record = maps.byValue.get(item.apiKey) || null;
      const aggregateId = record?.id || item.apiKey;

      if (!aggregated.has(aggregateId)) {
        aggregated.set(aggregateId, {
          ...emptyMetric(record),
          foundInUsage: true,
        });
      }

      const current = aggregated.get(aggregateId);
      current.totalRequests += Number(item.requests || 0);
      current.totalInputTokens += Number(item.promptTokens || 0);
      current.totalOutputTokens += Number(item.completionTokens || 0);
      current.totalEstimatedCost += Number(item.cost || 0);
    }

    const filterRecord = resolveFilterValue(searchParams, maps);

    if (filterRecord === null) {
      return serviceJson(request, { error: "API key not found" }, { status: 404 });
    }

    if (filterRecord) {
      const metric = aggregated.get(filterRecord.id) || emptyMetric(filterRecord);
      return serviceJson(request, {
        period,
        metric,
      });
    }

    const metrics = keys.map((record) => aggregated.get(record.id) || emptyMetric(record));
    for (const metric of aggregated.values()) {
      if (!metric.knownKey) {
        metrics.push(metric);
      }
    }
    metrics.sort((a, b) => b.totalRequests - a.totalRequests);

    return serviceJson(request, {
      period,
      metrics,
    });
  } catch (error) {
    console.error("[Service API] Failed to get API key usage metrics:", error);
    return serviceJson(request, { error: "Failed to fetch API key usage metrics" }, { status: 500 });
  }
}
