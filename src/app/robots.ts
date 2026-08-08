import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "./seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/agents",
        "/benchmark",
        "/billing",
        "/components",
        "/dashboard",
        "/failures",
        "/integration$",
        "/integration/",
        "/login",
        "/replay",
        "/reports",
        "/runs",
        "/scenarios",
        "/setup",
        "/share",
        "/signup",
      ],
    },
    sitemap: getAbsoluteUrl("/sitemap.xml"),
  };
}
