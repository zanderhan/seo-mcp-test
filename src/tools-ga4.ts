import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getAnalyticsData, getGA4PropertyId } from './google.js';

export function registerGa4Tools(server: McpServer) {
  server.tool(
    'ga4_run_report',
    `Run a Google Analytics 4 report. Returns metrics broken down by dimensions.

Common dimensions: pagePath, landingPage, sessionDefaultChannelGroup, date, deviceCategory, country, city, browser
Common metrics: sessions, activeUsers, screenPageViews, engagementRate, bounceRate, conversions, totalRevenue, averageSessionDuration, newUsers

Examples:
- Top landing pages by sessions: dimensions=["landingPage"], metrics=["sessions","engagementRate","conversions"]
- Channel breakdown: dimensions=["sessionDefaultChannelGroup"], metrics=["sessions","activeUsers","conversions"]
- Daily trend: dimensions=["date"], metrics=["sessions","activeUsers"]`,
    {
      dimensions: z
        .array(z.string())
        .default(['pagePath'])
        .describe('Dimensions to group results by'),
      metrics: z
        .array(z.string())
        .default(['sessions', 'activeUsers', 'screenPageViews', 'engagementRate', 'conversions'])
        .describe('Metrics to include'),
      start_date: z
        .string()
        .default('28daysAgo')
        .describe('Start date: YYYY-MM-DD or relative (7daysAgo, 28daysAgo, yesterday, today)'),
      end_date: z
        .string()
        .default('today')
        .describe('End date: YYYY-MM-DD or today, yesterday'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(100000)
        .default(10)
        .describe('Max rows to return'),
      order_by_metric: z
        .string()
        .optional()
        .describe('Metric to sort by descending, e.g. "sessions"'),
      dimension_filter: z
        .object({
          dimension: z.string().describe('Dimension name to filter on'),
          value: z.string().describe('Value to match (exact)'),
        })
        .optional()
        .describe('Filter to a specific dimension value, e.g. { dimension: "sessionDefaultChannelGroup", value: "Organic Search" }'),
    },
    async ({ dimensions, metrics, start_date, end_date, limit, order_by_metric, dimension_filter }) => {
      try {
        const propertyId = getGA4PropertyId();
        const analytics = getAnalyticsData();

        const response = await analytics.properties.runReport({
          property: `properties/${propertyId}`,
          requestBody: {
            dimensions: dimensions.map((name) => ({ name })),
            metrics: metrics.map((name) => ({ name })),
            dateRanges: [{ startDate: start_date, endDate: end_date }],
            limit,
            orderBys: order_by_metric
              ? [{ metric: { metricName: order_by_metric }, desc: true }]
              : undefined,
            dimensionFilter: dimension_filter
              ? {
                  filter: {
                    fieldName: dimension_filter.dimension,
                    stringFilter: {
                      value: dimension_filter.value,
                      matchType: 'EXACT',
                    },
                  },
                }
              : undefined,
          },
        });

        const data = response.data;

        if (!data.rows || data.rows.length === 0) {
          return { content: [{ type: 'text', text: 'No data returned for this query.' }] };
        }

        const dimHeaders = (data.dimensionHeaders ?? []).map((h) => h.name ?? '');
        const metHeaders = (data.metricHeaders ?? []).map((h) => h.name ?? '');
        const headers = [...dimHeaders, ...metHeaders];

        const rows = data.rows.map((row) => {
          const dimValues = (row.dimensionValues ?? []).map((v) => v.value ?? '');
          const metValues = (row.metricValues ?? []).map((v) => v.value ?? '');
          return [...dimValues, ...metValues];
        });

        // Format as tab-separated table
        const table = [headers, ...rows].map((row) => row.join('\t')).join('\n');

        const text = [
          `GA4 Report | Property: ${propertyId} | ${start_date} → ${end_date}`,
          `Showing ${rows.length} of ${data.rowCount ?? rows.length} rows`,
          '',
          table,
        ].join('\n');

        return { content: [{ type: 'text', text }] };
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text', text: `GA4 error: ${message}` }] };
      }
    }
  );
}
