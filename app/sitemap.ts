import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  // TODO: set to the real deployed origin before launch.
  const base = "https://nbatrademachine.app";
  return [{ url: base, changeFrequency: "daily", priority: 1 }];
}
