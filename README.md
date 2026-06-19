# SEO Analytics MCP Server

MCP server for Google Analytics 4 and Search Console. Deploys to Railway and connects to Claude as a custom connector.

## Tools

| Tool | Description |
|---|---|
| `ga4_run_report` | Traffic, engagement, conversions by page/channel/date |
| `gsc_query_performance` | Clicks, impressions, CTR, position from Search Console |
| `gsc_inspect_url` | Index status, crawl date, canonical, mobile usability |
| `gsc_list_sitemaps` | List submitted sitemaps and their status |
| `gsc_submit_sitemap` | Submit a new sitemap URL |
| `gsc_delete_sitemap` | Remove a sitemap from Search Console |

---

## Setup

### 1. Google Cloud project

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and create a project (or use an existing one).
2. Enable these APIs:
   - **Google Analytics Data API**
   - **Google Search Console API**
   - **Web Search Analytics API**
3. Go to **IAM & Admin → Service Accounts → Create Service Account**.
4. Name it (e.g. `seo-mcp`), skip optional fields, click **Done**.
5. Click the service account → **Keys → Add Key → JSON**. Download the file.
6. Keep the `client_email` from the JSON — you'll need it for steps below.

### 2. Grant the service account access

**Google Analytics 4:**
1. Open GA4 → Admin → Property → Property Access Management.
2. Click **+** → Add user → paste the `client_email`.
3. Set role to **Viewer**.

**Google Search Console:**
1. Open Search Console → Settings → Users and permissions.
2. Click **Add user** → paste the `client_email`.
3. Set permission to **Full** (required for sitemap submit/delete).

### 3. Find your IDs

- **GA4 Property ID**: GA4 Admin → Property Settings → Property ID (numeric only, e.g. `123456789`)
- **GSC Site URL**: Exactly as it appears in Search Console (e.g. `https://example.com/` with trailing slash, or `sc-domain:example.com` for domain properties)

### 4. Deploy to Railway

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo → select this repo.
3. Railway will detect Node.js and run `npm install && npm run build` automatically.
4. Go to **Variables** and add:

```
MCP_AUTH_TOKEN        = <generate with: openssl rand -hex 32>
GOOGLE_CREDENTIALS_JSON = <paste the entire contents of your service account JSON key, minified to one line>
GA4_PROPERTY_ID       = 123456789
GSC_SITE_URL          = https://example.com/
```

To minify the credentials JSON to one line (Mac/Linux):
```bash
cat your-key-file.json | jq -c . | pbcopy
```

5. Deploy. Railway will give you a public domain like `https://seo-mcp-production.up.railway.app`.
6. Test the health check:
```bash
curl https://your-railway-domain.up.railway.app/health
```

### 5. Connect to Claude

**Claude Pro/Max (personal):**
1. Open Claude → Customize → Connectors → **+ Add custom connector**
2. Enter your Railway URL: `https://your-railway-domain.up.railway.app/mcp`
3. Add the Authorization header: `Bearer your-mcp-auth-token`

**Claude Team/Enterprise:**
- Owner adds it under **Organization Settings → Connectors**

### 6. Test in Claude

Enable the connector in a chat and try:

```
What are my top 10 landing pages by sessions for the last 28 days?
```
```
Show me my GSC performance for the past 30 days, grouped by query.
```
```
Inspect https://example.com/blog/my-post
```
```
List all my submitted sitemaps.
```

---

## Local development

```bash
cp .env.example .env
# Fill in .env with your real values

npm install
npm run dev
```

Test locally:
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

---

## Environment variables

| Variable | Description |
|---|---|
| `MCP_AUTH_TOKEN` | Secret token for bearer auth. Generate with `openssl rand -hex 32` |
| `GOOGLE_CREDENTIALS_JSON` | Full contents of the service account JSON key (single line) |
| `GA4_PROPERTY_ID` | GA4 numeric property ID (e.g. `123456789`) |
| `GSC_SITE_URL` | Exact site URL from Search Console (e.g. `https://example.com/`) |
| `PORT` | Port to listen on. Set automatically by Railway. Defaults to `3000` |
