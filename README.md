# n8n-nodes-taxmaro

[n8n](https://n8n.io) community node for the [Taxmaro](https://app.taxmaro.com) HR and payroll API (v1).

The node covers all 63 resources / 213 operations of the Taxmaro OpenAPI specification: absence requests, time tracking, allowances, colleagues, companies, contracts, cost centers, master data (banks, countries, health insurances, …) and more.

## Installation

In n8n open **Settings → Community Nodes → Install** and enter `n8n-nodes-taxmaro`.
See the [n8n docs](https://docs.n8n.io/integrations/community-nodes/installation/) for details.

## Credentials

Create a **Taxmaro API** credential:

| Field | Description |
| --- | --- |
| Base URL | `https://app.taxmaro.com` (change it for other environments). Use the **API host**, not the host of the web interface: white-label hosts such as `https://payroll-….taxmaro.co` serve the web UI and reject the login with HTTP 405. |
| Email / Password | Your Taxmaro login |

The node logs in via `POST /api/v1/users/sessions` and sends the returned JWT as `Authorization: Bearer …`. The session token is refreshed automatically when it expires.

## Usage

Pick a **Resource** and an **Operation**. Resources that exist for several scopes (for example absence requests for a company or a colleague) offer one operation per scope, e.g. *Get Many (Company)*.

- **Path IDs** (company, colleague, record, …) are plain fields and accept expressions.
- **Create / Update** operations take the JSON request body. It is prefilled with an example from the API documentation.
- **Get Many** supports *Return All* (automatic pagination via `page` / `per_page`) or a *Limit*. Under *Query Parameters* you can set sorting, search and any filter the API offers (`by_year`, `by_departments[]`, …); the available filters are listed in the operation description.
- **Export** operations (CSV / XLSX) return the file as binary data.
- **Simplify** (default on) flattens the JSON:API response into plain objects: `id`, all attributes and the IDs of related records.
- **Selected Colleague ID** (Options) sets the `selectedColleagueId` header.

## Development

```bash
npm install
npm run build
npm run lint
npm run dev      # starts n8n with the node loaded
```

`nodes/Taxmaro/operations.generated.ts` is generated from the OpenAPI spec:

```bash
npm run generate -- /path/to/openapi.json
```

## Notes on the API spec

- The spec documents "create salary type" under the path `/unauthenticated`; the node uses `POST /companies/{company_id}/salary_types`.
- The spec does not state a server URL; `https://app.taxmaro.com` is the default in the credential.

## License

[MIT](LICENSE)
