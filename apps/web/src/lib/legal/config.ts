import "server-only";

import type { LegalConfig } from "./schema";

const value = (name: string) => process.env[name]?.trim() || null;

export function getLegalConfig(): LegalConfig {
  const identity = {
    entityName: value("LEGAL_ENTITY_NAME"),
    entityForm: value("LEGAL_ENTITY_FORM"),
    address: value("LEGAL_ENTITY_ADDRESS"),
    email: value("LEGAL_ENTITY_EMAIL"),
    registration: value("LEGAL_ENTITY_REGISTRATION"),
    vat: value("LEGAL_ENTITY_VAT"),
    publisher: value("LEGAL_PUBLISHER_NAME"),
    hostName: value("LEGAL_HOST_NAME"),
    hostAddress: value("LEGAL_HOST_ADDRESS"),
    privacyEmail: value("PRIVACY_CONTACT_EMAIL"),
    dpoEmail: value("DPO_CONTACT_EMAIL"),
  };
  const retention = {
    account: value("ACCOUNT_RETENTION_POLICY"),
    sessions: value("SESSION_RETENTION_DAYS"),
    conversations: value("CONVERSATION_RETENTION_POLICY"),
    oauthMinutes: value("OAUTH_SESSION_RETENTION_MINUTES"),
    auditDays: value("AUDIT_RETENTION_DAYS"),
    logsDays: value("LOG_RETENTION_DAYS"),
    deletedAccountGraceDays: value("DELETED_ACCOUNT_GRACE_DAYS"),
    attachmentsDays: value("ATTACHMENT_RETENTION_DAYS"),
  };
  const configured = Boolean(identity.entityName && identity.address && identity.email && identity.publisher && identity.hostName);
  return { identity, retention, configured, policyVersion: "Draft 0.1", effectiveDate: null, lastUpdated: "2026-07-23" };
}
