const LOCAL_SITE_URL = "http://localhost:3000";

export function getSiteUrl(): URL {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    normalizeHostedUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL);

  if (!configuredUrl) {
    return new URL(LOCAL_SITE_URL);
  }

  try {
    const url = new URL(configuredUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return new URL(LOCAL_SITE_URL);
    }

    url.username = "";
    url.password = "";
    url.pathname = "/";
    url.search = "";
    url.hash = "";

    return url;
  } catch {
    return new URL(LOCAL_SITE_URL);
  }
}

function normalizeHostedUrl(value: string | undefined): string | undefined {
  const hostname = value?.trim();

  if (!hostname) {
    return undefined;
  }

  return hostname.startsWith("http://") || hostname.startsWith("https://")
    ? hostname
    : `https://${hostname}`;
}

export function getAbsoluteUrl(pathname = "/"): string {
  return new URL(pathname, getSiteUrl()).toString();
}
