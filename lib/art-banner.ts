import { getDatabase } from "@/lib/database";

import { ART_BANNER_ID } from "@/lib/art-app";

type ArtBannerSettings = { id: string; enabled: boolean; updatedAt?: string };

export async function getArtBannerEnabled() {
  const db = await getDatabase();
  const settings = await db.collection<ArtBannerSettings>("dashboard_promotions").findOne({ id: ART_BANNER_ID });
  return settings?.enabled !== false;
}

export async function setArtBannerEnabled(enabled: boolean) {
  const db = await getDatabase();
  await db.collection<ArtBannerSettings>("dashboard_promotions").updateOne(
    { id: ART_BANNER_ID },
    { $set: { enabled, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
}
