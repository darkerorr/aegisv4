export type LegalConfig = {
  configured: boolean;
  identity: {
    entityName: string | null;
    entityForm: string | null;
    address: string | null;
    email: string | null;
    registration: string | null;
    vat: string | null;
    publisher: string | null;
    hostName: string | null;
    hostAddress: string | null;
    privacyEmail: string | null;
    dpoEmail: string | null;
  };
  retention: {
    account: string | null;
    sessions: string | null;
    conversations: string | null;
    oauthMinutes: string | null;
    auditDays: string | null;
    logsDays: string | null;
    deletedAccountGraceDays: string | null;
    attachmentsDays: string | null;
  };
  policyVersion: string;
  effectiveDate: string | null;
  lastUpdated: string;
};
