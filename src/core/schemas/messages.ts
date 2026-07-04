// Message contract schemas — see 01-architecture.md "Message contract (authoritative)".
// The panel validates inbound service-worker messages; the service worker validates
// inbound panel messages. Reject and surface anything that fails validation.

import { z } from 'zod';
import { PageSnapshotSchema } from './snapshot';

export const AuditRequestSchema = z.object({
  type: z.literal('AUDIT_REQUEST'),
  tabId: z.number(),
  url: z.string(),
});
export type AuditRequest = z.infer<typeof AuditRequestSchema>;

export const CollectRequestSchema = z.object({
  type: z.literal('COLLECT_SNAPSHOT'),
});
export type CollectRequest = z.infer<typeof CollectRequestSchema>;

export const AuditResultSchema = z.object({
  type: z.literal('AUDIT_RESULT'),
  snapshot: PageSnapshotSchema,
  rawHtmlString: z.string().nullable(),
});
export type AuditResult = z.infer<typeof AuditResultSchema>;

export const AuditErrorSchema = z.object({
  type: z.literal('AUDIT_ERROR'),
  message: z.string(),
});
export type AuditError = z.infer<typeof AuditErrorSchema>;

export const PanelInboundMessageSchema = z.discriminatedUnion('type', [
  AuditResultSchema,
  AuditErrorSchema,
]);
export type PanelInboundMessage = z.infer<typeof PanelInboundMessageSchema>;
