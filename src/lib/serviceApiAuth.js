import { NextResponse } from "next/server";

const SERVICE_AUTH_HEADER = "x-service-token";

function parseAllowedOrigins() {
  const raw = process.env.SERVICE_ALLOWED_ORIGINS || "";
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  const allowed = parseAllowedOrigins();
  if (allowed.length === 0) return false;
  return allowed.includes(origin);
}

export function getServiceTokenFromRequest(request) {
  const authHeader = request.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  const headerToken = request.headers.get(SERVICE_AUTH_HEADER);
  return headerToken ? headerToken.trim() : "";
}

export function isServiceAuthorized(request) {
  const expected = process.env.SERVICE_API_TOKEN || "";
  if (!expected) return false;

  const incoming = getServiceTokenFromRequest(request);
  return incoming.length > 0 && incoming === expected;
}

export function buildServiceCorsHeaders(request, methods = ["GET", "POST", "OPTIONS"]) {
  const origin = request.headers.get("origin");
  if (!isOriginAllowed(origin)) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": methods.join(", "),
    "Access-Control-Allow-Headers": "Content-Type, Authorization, x-service-token",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

export function serviceCorsResponse(request, methods = ["GET", "POST", "OPTIONS"]) {
  return new NextResponse(null, {
    status: 204,
    headers: buildServiceCorsHeaders(request, methods),
  });
}

export function serviceUnauthorizedResponse(request, message = "Unauthorized") {
  return NextResponse.json(
    { error: message },
    {
      status: 401,
      headers: buildServiceCorsHeaders(request),
    }
  );
}

export function serviceJson(request, payload, init = {}) {
  const status = init.status || 200;
  const headers = {
    ...buildServiceCorsHeaders(request),
    ...(init.headers || {}),
  };

  return NextResponse.json(payload, { status, headers });
}

