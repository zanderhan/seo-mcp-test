import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSearchConsole, getGscSiteUrl } from './google.js';

export function registerGscTools(server: McpServer) {
  // ─── Performance data ────────────────────────────────────────────────────────

  server.tool(
    'gsc_query_performance',
    `Query Google Search Console performance data. Returns clicks, impressions, CTR, and average position.

Examples:
- Top queries: dimensions=["query"], ordered by clicks
- Top pages: dimensions=["page"]
- Query + page together: dimensions=["query","page"]
- Date trend: dimensions=["date"]
- Filter to a specific page: filter_page="/blog/my-article"
- Filter to a specific query: filter_query="keyword"`,
    {
      start_date: z.string().describe('Start date in YYYY-MM-DD format'),
      end_date: z.string().describe('End date in YYYY-MM-DD format'),
      dimensions: z
        .array(z.enum(['query', 'page', 'country', 'device', 'searchAppearance', 'date']))
        .default(['query'])
        .describe('Dimensions to group results by'),
      row_limit: z
        .number()
        .int()
        .min(1)
        .max(25000)
        .default(10)
        .describe('Number of rows to return'),
      start_row: z
        .number()
        .int()
        .min(0)
        .default(0)
        .describe('Row offset for pagination'),
      filter_query: z
        .string()
        .optional()
        .describe('Filter to rows containing this query string'),
      filter_page: z
        .string()
        .optional()
        .describe('Filter to rows containing this page URL or path'),
    },
    async ({ start_date, end_date, dimensions, row_limit, start_row, filter_query, filter_page }) => {
      try {
        const siteUrl = getGscSiteUrl();
        const gsc = getSearchConsole();

        const dimensionFilterGroups: object[] = [];
        if (filter_query) {
          dimensionFilterGroups.push({
            filters: [{ dimension: 'query', operator: 'contains', expression: filter_query }],
          });
        }
        if (filter_page) {
          dimensionFilterGroups.push({
            filters: [{ dimension: 'page', operator: 'contains', expression: filter_page }],
          });
        }

        const response = await gsc.searchanalytics.query({
          siteUrl,
          requestBody: {
            startDate: start_date,
            endDate: end_date,
            dimensions,
            rowLimit: row_limit,
            startRow: start_row,
            dimensionFilterGroups: dimensionFilterGroups.length > 0 ? dimensionFilterGroups : undefined,
          },
        });

        const rows = response.data.rows;
        if (!rows || rows.length === 0) {
          return { content: [{ type: 'text', text: 'No data returned for this query.' }] };
        }

        const headers = [...dimensions, 'clicks', 'impressions', 'ctr', 'position'];
        const dataRows = rows.map((row) => {
          const keys = row.keys ?? [];
          const clicks = String(Math.round(row.clicks ?? 0));
          const impressions = String(Math.round(row.impressions ?? 0));
          const ctr = ((row.ctr ?? 0) * 100).toFixed(2) + '%';
          const position = (row.position ?? 0).toFixed(1);
          return [...keys, clicks, impressions, ctr, position];
        });

        const table = [headers, ...dataRows].map((row) => row.join('\t')).join('\n');

        const text = [
          `GSC Performance | ${siteUrl} | ${start_date} → ${end_date}`,
          `Showing ${dataRows.length} rows`,
          '',
          table,
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `GSC error: ${message}` }] };
      }
    }
  );

  // ─── URL Inspection ───────────────────────────────────────────────────────────

  server.tool(
    'gsc_inspect_url',
    'Inspect a URL using the Google Search Console URL Inspection API. Returns index status, last crawl date, canonical URL, crawlability, mobile usability, and rich results verdict.',
    {
      url: z.string().url().describe('The full URL to inspect, e.g. https://example.com/blog/post'),
    },
    async ({ url }) => {
      try {
        const siteUrl = getGscSiteUrl();
        const gsc = getSearchConsole();

        const response = await gsc.urlInspection.index.inspect({
          requestBody: {
            inspectionUrl: url,
            siteUrl,
          },
        });

        const result = response.data.inspectionResult;
        if (!result) {
          return { content: [{ type: 'text', text: 'No inspection result returned.' }] };
        }

        const idx = result.indexStatusResult;
        const mobile = result.mobileUsabilityResult;
        const rich = result.richResultsResult;

        const mobileIssues =
          mobile?.issues && mobile.issues.length > 0
            ? mobile.issues.map((i) => `    • ${i.issueType}`).join('\n')
            : '    None';

        const richItems =
          rich?.detectedItems && rich.detectedItems.length > 0
            ? rich.detectedItems
                .map((item) => `    • ${item.richResultType}: ${item.items?.map((i) => i.name).join(', ')}`)
                .join('\n')
            : '    None detected';

        const text = [
          `URL Inspection: ${url}`,
          '',
          'INDEX STATUS',
          `  Verdict:          ${idx?.verdict ?? 'unknown'}`,
          `  Coverage state:   ${idx?.coverageState ?? 'unknown'}`,
          `  Indexing state:   ${idx?.indexingState ?? 'unknown'}`,
          `  Last crawled:     ${idx?.lastCrawlTime ?? 'never'}`,
          `  Crawled as:       ${idx?.crawledAs ?? 'unknown'}`,
          `  Robots.txt:       ${idx?.robotsTxtState ?? 'unknown'}`,
          `  Google canonical: ${idx?.googleCanonical ?? 'not set'}`,
          `  User canonical:   ${idx?.userCanonical ?? 'not set'}`,
          '',
          'MOBILE USABILITY',
          `  Verdict: ${mobile?.verdict ?? 'unknown'}`,
          `  Issues:\n${mobileIssues}`,
          '',
          'RICH RESULTS',
          `  Verdict: ${rich?.verdict ?? 'unknown'}`,
          `  Detected:\n${richItems}`,
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `URL Inspection error: ${message}` }] };
      }
    }
  );

  // ─── List sitemaps ────────────────────────────────────────────────────────────

  server.tool(
    'gsc_list_sitemaps',
    'List all sitemaps submitted to Google Search Console for this property, including their submission date, last download date, and URL counts.',
    {},
    async () => {
      try {
        const siteUrl = getGscSiteUrl();
        const gsc = getSearchConsole();

        const response = await gsc.sitemaps.list({ siteUrl });
        const sitemaps = response.data.sitemap;

        if (!sitemaps || sitemaps.length === 0) {
          return { content: [{ type: 'text', text: `No sitemaps found for ${siteUrl}` }] };
        }

        const lines = sitemaps.map((s) => {
          const urlCounts =
            s.contents
              ?.map((c) => `${c.type}: ${c.submitted ?? 0} submitted / ${c.indexed ?? 0} indexed`)
              .join(', ') ?? 'unknown';

          return [
            `${s.path}`,
            `  Type:           ${s.type ?? 'unknown'}`,
            `  Last submitted: ${s.lastSubmitted ?? 'unknown'}`,
            `  Last downloaded:${s.lastDownloaded ?? 'unknown'}`,
            `  Is sitemap index: ${s.isSitemapsIndex ?? false}`,
            `  Is pending:     ${s.isPending ?? false}`,
            `  URLs:           ${urlCounts}`,
          ].join('\n');
        });

        const text = [`Sitemaps for ${siteUrl} (${sitemaps.length} total)`, '', ...lines].join('\n\n');
        return { content: [{ type: 'text', text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `GSC error: ${message}` }] };
      }
    }
  );

  // ─── Submit sitemap ───────────────────────────────────────────────────────────

  server.tool(
    'gsc_submit_sitemap',
    'Submit a sitemap to Google Search Console. Google will begin crawling it within a few days.',
    {
      sitemap_url: z
        .string()
        .url()
        .describe('Full URL of the sitemap to submit, e.g. https://example.com/sitemap.xml'),
    },
    async ({ sitemap_url }) => {
      try {
        const siteUrl = getGscSiteUrl();
        const gsc = getSearchConsole();

        await gsc.sitemaps.submit({
          siteUrl,
          feedpath: sitemap_url,
        });

        return {
          content: [{ type: 'text', text: `Sitemap submitted successfully: ${sitemap_url}` }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `GSC error: ${message}` }] };
      }
    }
  );

  // ─── Delete sitemap ───────────────────────────────────────────────────────────

  server.tool(
    'gsc_delete_sitemap',
    'Remove a sitemap from Google Search Console. This does not delete the sitemap file itself — it only stops Google from using it via Search Console.',
    {
      sitemap_url: z
        .string()
        .url()
        .describe('Full URL of the sitemap to remove, e.g. https://example.com/old-sitemap.xml'),
    },
    async ({ sitemap_url }) => {
      try {
        const siteUrl = getGscSiteUrl();
        const gsc = getSearchConsole();

        await gsc.sitemaps.delete({
          siteUrl,
          feedpath: sitemap_url,
        });

        return {
          content: [{ type: 'text', text: `Sitemap removed from Search Console: ${sitemap_url}` }],
        };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `GSC error: ${message}` }] };
      }
    }
  );
}
