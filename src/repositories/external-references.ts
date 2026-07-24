import { and, eq } from "drizzle-orm";
import type { Database } from "@/db/types";
import type { EntityType, ReferenceProvider } from "@/db/schema";
import { externalReferences } from "@/db/schema";

export async function findEntityIdByRef(
  db: Database,
  entityType: EntityType,
  provider: ReferenceProvider,
  externalId: string,
): Promise<string | null> {
  const rows = await db
    .select({ entityId: externalReferences.entityId })
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.entityType, entityType),
        eq(externalReferences.provider, provider),
        eq(externalReferences.externalId, externalId),
      ),
    )
    .limit(1);
  return rows[0]?.entityId ?? null;
}

export type ExternalReference = { externalId: string; url: string | null };

/** The reference for one entity from one provider, or null if none is recorded. */
export async function getExternalReference(
  db: Database,
  entityType: EntityType,
  entityId: string,
  provider: ReferenceProvider,
): Promise<ExternalReference | null> {
  const rows = await db
    .select({ externalId: externalReferences.externalId, url: externalReferences.url })
    .from(externalReferences)
    .where(
      and(
        eq(externalReferences.entityType, entityType),
        eq(externalReferences.entityId, entityId),
        eq(externalReferences.provider, provider),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

export type ExternalRefInput = {
  entityType: EntityType;
  entityId: string;
  provider: ReferenceProvider;
  externalId: string;
  url: string | null;
};

export async function upsertExternalReference(db: Database, ref: ExternalRefInput): Promise<void> {
  await db
    .insert(externalReferences)
    .values({
      entityType: ref.entityType,
      entityId: ref.entityId,
      provider: ref.provider,
      externalId: ref.externalId,
      url: ref.url,
    })
    .onConflictDoUpdate({
      target: [externalReferences.provider, externalReferences.entityType, externalReferences.externalId],
      set: { entityId: ref.entityId, url: ref.url, updatedAt: new Date() },
    });
}
