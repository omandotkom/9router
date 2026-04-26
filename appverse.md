# Appverse Integration Guide (9Router SaaS Control API)

Dokumen ini menjelaskan endpoint yang perlu dipanggil dari `appverse.id` untuk:
- membuat API key user,
- melihat daftar API key,
- mengambil metrik penggunaan **per API key**.

## 1) Konfigurasi Server 9Router

Set environment variable berikut di server 9Router:

```env
SERVICE_API_TOKEN=change-me-strong-service-token
SERVICE_ALLOWED_ORIGINS=https://appverse.id
```

Keterangan:
- `SERVICE_API_TOKEN`: token otorisasi service-to-service untuk `/api/service/*`.
- `SERVICE_ALLOWED_ORIGINS`: daftar origin dipisah koma untuk CORS endpoint service.

## 2) Base URL dan Auth

- Base URL contoh: `https://router.yourdomain.com`
- Semua endpoint service menggunakan salah satu header:
  - `Authorization: Bearer <SERVICE_API_TOKEN>`
  - atau `x-service-token: <SERVICE_API_TOKEN>`

Contoh header minimal:

```http
Authorization: Bearer <SERVICE_API_TOKEN>
Content-Type: application/json
```

## 3) Endpoint: Create API Key

### `POST /api/service/keys`

Membuat API key baru untuk dipakai user Appverse saat memanggil `/v1/*` 9Router.

### Request Body

```json
{
  "name": "appverse-user-123",
  "quota": {
    "enabled": true,
    "limit": 500000,
    "period": "monthly"
  }
}
```

Field:
- `name` (string, wajib)
- `quota` (opsional)
  - `enabled` (boolean)
  - `limit` (number > 0)
  - `period` (`daily` | `monthly` | `total`)

### Response 201

```json
{
  "id": "0c7c9f6e-2fce-4b17-9cc6-0f0a9f8fd1d1",
  "name": "appverse-user-123",
  "key": "sk-xxxxxxxx-xxxxxx-xxxxxxxx",
  "machineId": "xxxxxxxx",
  "createdAt": "2026-04-24T16:00:00.000Z",
  "isActive": true,
  "quota": {
    "enabled": true,
    "limit": 500000,
    "period": "monthly",
    "resetAt": "2026-05-01T00:00:00.000Z",
    "usedTokens": 0,
    "remainingTokens": 500000
  }
}
```

### Error
- `400` jika `name` kosong, body JSON invalid, atau quota invalid.
- `401` jika token service salah/tidak ada.
- `500` jika server error.

## 4) Endpoint: List API Keys

### `GET /api/service/keys`

Mengambil daftar API key (nilai key disamarkan untuk keamanan).

### Response 200

```json
{
  "keys": [
    {
      "id": "0c7c9f6e-2fce-4b17-9cc6-0f0a9f8fd1d1",
      "name": "appverse-user-123",
      "machineId": "xxxxxxxx",
      "isActive": true,
      "createdAt": "2026-04-24T16:00:00.000Z",
      "usage": {
        "usedTokens": 12000,
        "lastResetAt": "2026-04-24T16:00:00.000Z"
      },
      "quota": {
        "enabled": true,
        "limit": 500000,
        "period": "monthly",
        "resetAt": "2026-05-01T00:00:00.000Z"
      },
      "keyMasked": "sk-xxxxxxxxxx..."
    }
  ]
}
```


## 4b) Endpoint: Manage Single API Key (Activate/Deactivate/Delete)

### `GET /api/service/keys/{id}`

Mengambil detail 1 API key berdasarkan `id`.

### Response 200

```json
{
  "key": {
    "id": "0c7c9f6e-2fce-4b17-9cc6-0f0a9f8fd1d1",
    "name": "appverse-user-123",
    "machineId": "xxxxxxxx",
    "isActive": true,
    "createdAt": "2026-04-24T16:00:00.000Z",
    "usage": {
      "usedTokens": 12000,
      "lastResetAt": "2026-04-24T16:00:00.000Z"
    },
    "quota": {
      "enabled": true,
      "limit": 500000,
      "period": "monthly",
      "resetAt": "2026-05-01T00:00:00.000Z"
    },
    "keyMasked": "sk-xxxxxxxxxx..."
  }
}
```

### `PATCH /api/service/keys/{id}`

Update status API key (soft-delete menggunakan `isActive=false`).

### Request Body

```json
{
  "isActive": false
}
```

### Response 200

```json
{
  "key": {
    "id": "0c7c9f6e-2fce-4b17-9cc6-0f0a9f8fd1d1",
    "name": "appverse-user-123",
    "isActive": false,
    "createdAt": "2026-04-24T16:00:00.000Z",
    "keyMasked": "sk-xxxxxxxxxx..."
  },
  "message": "API key deactivated"
}
```

### `DELETE /api/service/keys/{id}`

- Default: **soft delete** (`isActive=false`).
- Hard delete opsional dengan query `?hard=true`.

Contoh:
- Soft delete: `DELETE /api/service/keys/{id}`
- Hard delete: `DELETE /api/service/keys/{id}?hard=true`

### Error
- `400` khusus `PATCH` jika body invalid (`isActive` bukan boolean).
- `401` token service invalid.
- `404` key tidak ditemukan.

## 5) Endpoint: Usage Metrics per API Key

### `GET /api/service/usage/api-keys`

Mengambil metrik per API key dari data usage 9Router.

### Query Params
- `period` (opsional, default `7d`): `24h` | `7d` | `30d` | `60d` | `all`
- `apiKeyId` (opsional): filter ke satu API key berdasarkan id
- `apiKey` (opsional): filter ke satu API key berdasarkan nilai key

> Catatan: gunakan salah satu `apiKeyId` atau `apiKey`.

### Response 200 (semua key)

```json
{
  "period": "30d",
  "metrics": [
    {
      "apiKeyId": "0c7c9f6e-2fce-4b17-9cc6-0f0a9f8fd1d1",
      "name": "appverse-user-123",
      "isActive": true,
      "createdAt": "2026-04-24T16:00:00.000Z",
      "keyMasked": "sk-xxxxxxxxxx...",
      "totalRequests": 128,
      "totalInputTokens": 204500,
      "totalOutputTokens": 101200,
      "totalEstimatedCost": 3.4281,
      "foundInUsage": true,
      "knownKey": true
    }
  ]
}
```

### Response 200 (satu key)

Request:
`GET /api/service/usage/api-keys?period=30d&apiKeyId=0c7c9f6e-2fce-4b17-9cc6-0f0a9f8fd1d1`

Response:

```json
{
  "period": "30d",
  "metric": {
    "apiKeyId": "0c7c9f6e-2fce-4b17-9cc6-0f0a9f8fd1d1",
    "name": "appverse-user-123",
    "isActive": true,
    "createdAt": "2026-04-24T16:00:00.000Z",
    "keyMasked": "sk-xxxxxxxxxx...",
    "totalRequests": 128,
    "totalInputTokens": 204500,
    "totalOutputTokens": 101200,
    "totalEstimatedCost": 3.4281,
    "foundInUsage": true,
    "knownKey": true
  }
}
```

### Error
- `400` jika `period` tidak valid.
- `401` jika token service salah/tidak ada.
- `404` jika filter `apiKeyId` / `apiKey` tidak ditemukan.

## 6) cURL Example

### Create key

```bash
curl -X POST "https://router.yourdomain.com/api/service/keys" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"name":"appverse-user-123","quota":{"enabled":true,"limit":500000,"period":"monthly"}}'
```

### List keys

```bash
curl "https://router.yourdomain.com/api/service/keys" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>"
```

### Get one key

```bash
curl "https://router.yourdomain.com/api/service/keys/<KEY_ID>" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>"
```

### Deactivate key (soft delete)

```bash
curl -X PATCH "https://router.yourdomain.com/api/service/keys/<KEY_ID>" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isActive":false}'
```

### Activate key again

```bash
curl -X PATCH "https://router.yourdomain.com/api/service/keys/<KEY_ID>" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"isActive":true}'
```

### Delete key permanently (hard delete)

```bash
curl -X DELETE "https://router.yourdomain.com/api/service/keys/<KEY_ID>?hard=true" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>"
```

### Get usage per key (all)

```bash
curl "https://router.yourdomain.com/api/service/usage/api-keys?period=30d" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>"
```

### Get usage per key (single)

```bash
curl "https://router.yourdomain.com/api/service/usage/api-keys?period=30d&apiKeyId=<KEY_ID>" \
  -H "Authorization: Bearer <SERVICE_API_TOKEN>"
```

## 7) Alur Integrasi Appverse yang Disarankan

1. User bayar/aktif paket di `appverse.id`.
2. Backend Appverse panggil `POST /api/service/keys` untuk generate key.
3. Simpan `id` + `key` di DB Appverse (encrypted).
4. User memakai key tersebut ke endpoint `9Router /v1/*`.
5. Dashboard billing Appverse polling `GET /api/service/usage/api-keys?...` untuk metrik per key.

## 8) Catatan Penting

- `totalEstimatedCost` adalah estimasi berdasarkan pricing engine 9Router saat request diproses.
- Metrik per API key hanya tercatat jika request ke `/v1/*` membawa API key terkait.
- Untuk keamanan produksi, **utamakan server-to-server** (backend Appverse → 9Router), jangan expose `SERVICE_API_TOKEN` ke frontend browser.

