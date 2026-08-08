import type { MetadataRoute } from "next";
import { getAbsoluteUrl } from "./seo";

const MARKETING_ROUTES = [
  { path: "/", priority: 1 },
  { path: "/product", priority: 0.9 },
  { path: "/integrations", priority: 0.8 },
  { path: "/pricing", priority: 0.8 },
  { path: "/gauntlet", priority: 0.8 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return MARKETING_ROUTES.map(({ path, priority }) => ({
    url: getAbsoluteUrl(path),
    changeFrequency: "monthly",
    priority,
  }));
}
