function jsonSafe(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export function iosAuditData(context, {
  action,
  entityType,
  entityId,
  before,
  after,
  metadata,
}) {
  return {
    organizationId: context.organization.id,
    actorUserId: context.actor.id,
    actorName: context.actor.name,
    action,
    entityType,
    entityId: entityId ?? null,
    before: jsonSafe(before),
    after: jsonSafe(after),
    metadata: jsonSafe(metadata),
  };
}
