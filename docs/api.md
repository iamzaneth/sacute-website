# API contract

Base path: `/api/v1`. No authentication or write endpoints are implemented. All content currently comes from the shared local provider; no database calls are made.

| Endpoint            | Response                                                  |
| ------------------- | --------------------------------------------------------- |
| `GET /health`       | `{ "data": { "status": "ok", "service": "sacute-api" } }` |
| `GET /information`  | Paginated `Information` records                           |
| `GET /scholarships` | Paginated `Scholarship` records                           |
| `GET /events`       | Paginated `StudentEvent` records                          |

Lists use this envelope (an empty result is shown):

```json
{
  "data": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 12,
    "source": "local",
    "contentStatus": "pending-verification"
  }
}
```

`total` counts the filtered collection before pagination. Defaults: `page=1`, `limit=12`. `page` must be an integer from 1–100000; `limit` from 1–100. `q` is a case-insensitive Vietnamese title/summary search, at most 200 characters. `category` is an exact category match, at most 100 characters. Unknown query parameters are rejected. An out-of-range valid page returns an empty list.

Validation and HTTP errors use:

```json
{
  "error": {
    "statusCode": 400,
    "message": ["page must not be less than 1"]
  }
}
```

`message` may be a string or a string array. Unknown routes return HTTP 404 in the same envelope. NestJS retains its default handling for unexpected internal exceptions; stack traces are not sent to clients.

All content types are defined in `packages/shared/src/index.ts`. The API has no dynamic detail endpoints; frontend `/posts/:slug` pages are prerendered from the same approved local content.

CORS responds only for exact configured origins. It is a browser access policy, not authentication. Set `CORS_ORIGINS` to a comma-separated list of exact HTTP(S) origins; production startup fails if it is absent. `PORT` defaults to 3001 and must be from 1–65535. Each API process loads `apps/api/.env` when started with the documented workspace commands.
