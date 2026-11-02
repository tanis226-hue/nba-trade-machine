import type { MetadataRoute } from "next";
import { getTeams } from "@/lib/data/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://nbatm.zldagroup.com";
  const teams = await getTeams();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/contracts`, changeFrequency: "daily", priority: 0.9 },
    ...teams.map((t) => ({
      url: `${base}/team/${t.abbr.toLowerCase()}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
