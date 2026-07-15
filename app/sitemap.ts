import type { MetadataRoute } from "next";
import { getTeams } from "@/lib/data/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://nbatm.zldagroup.com";
  const teams = await getTeams();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...teams.map((t) => ({
      url: `${base}/team/${t.abbr.toLowerCase()}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
