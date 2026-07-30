// Envelope v2 schema — T21 Service Principal + five-level Relationship.
// Defined per whitepaper §3.1–§3.4. Team3 file (zod-from-schemas.ts) is NOT modified.
import { z } from "zod";

// ---- Service Principal (§3.1) ----

export const ServicePrincipalSchema = z.object({
  person: z.string().min(1),
  org: z.string().min(1),
  role: z.enum(["student", "teacher", "agent", "admin", "system"]),
});

export type ServicePrincipal = z.infer<typeof ServicePrincipalSchema>;

// ---- Manifest Owner (AGENT_CN.md §2.1) ----

export const ManifestOwnerSchema = z.object({
  owner_type: z.enum(["student", "teacher", "system"]),
  owner_id: z.string().min(1),
});

export type ManifestOwner = z.infer<typeof ManifestOwnerSchema>;

// ---- Route hop + routing extension (AGENT_CN.md §8.1) ----

export const RouteHopSchema = z.object({
  agent_id: z.string(),
  action: z.enum(["origin", "forward", "deliver"]),
  protocol: z.string(), // e.g. 'redis-stream/v1'
  ts: z.string(),
});

export type RouteHop = z.infer<typeof RouteHopSchema>;

export const RoutingExtensionSchema = z.object({
  protocol: z.string(),
  route: z.array(RouteHopSchema).min(1).max(20),
});

export type RoutingExtension = z.infer<typeof RoutingExtensionSchema>;

// ---- Relationship (§3.2) ----

export const RelationshipTypeSchema = z.enum([
  "owner",
  "administrator",
  "peer",
  "client",
  "anonymous",
]);

export const ApprovalModeSchema = z.enum(["auto", "require-approval", "denied"]);

export const RelationshipSchema = z.object({
  relationship_id: z.string(),
  from: ServicePrincipalSchema,
  to: ServicePrincipalSchema,
  type: RelationshipTypeSchema,
  capabilities: z.array(z.string()),
  allowed_channels: z.array(z.string()),
  rate_limit: z.string().optional(),
  approval: ApprovalModeSchema,
});

export type Relationship = z.infer<typeof RelationshipSchema>;

// ---- Envelope v2 (§3.4) ----

export const MessageTypeV2Schema = z.enum([
  "submission_request",
  "challenge_publish",
  "review_request",
  "manual_review_adjustment",
  "peer_review_request",
  "task_query",
]);

export const EnvelopeV2Schema = z.object({
  message_id: z.string(),
  request_id: z.string(),
  from: ServicePrincipalSchema,
  to: ServicePrincipalSchema,
  message_type: MessageTypeV2Schema,
  context_id: z.string().optional(),
  task_id: z.string().optional(),
  timestamp: z.string(),
  payload: z.record(z.unknown()),
  signature: z.string().optional(),
  audit_trace_pointer: z.string(),
});

export type EnvelopeV2 = z.infer<typeof EnvelopeV2Schema>;
