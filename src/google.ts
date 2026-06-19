import { google } from 'googleapis';

function getCredentials() {
  const json = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!json) throw new Error('GOOGLE_CREDENTIALS_JSON environment variable is required');
  try {
    return JSON.parse(json);
  } catch {
    throw new Error('GOOGLE_CREDENTIALS_JSON is not valid JSON');
  }
}

export function getAnalyticsData() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  });
  return google.analyticsdata({ version: 'v1beta', auth });
}

export function getSearchConsole() {
  const auth = new google.auth.GoogleAuth({
    credentials: getCredentials(),
    // webmasters scope covers both read and write (sitemap submit/delete)
    scopes: ['https://www.googleapis.com/auth/webmasters'],
  });
  return google.searchconsole({ version: 'v1', auth });
}

export function getGA4PropertyId(): string {
  const id = process.env.GA4_PROPERTY_ID;
  if (!id) throw new Error('GA4_PROPERTY_ID environment variable is required');
  return id;
}

export function getGscSiteUrl(): string {
  const url = process.env.GSC_SITE_URL;
  if (!url) throw new Error('GSC_SITE_URL environment variable is required');
  return url;
}
