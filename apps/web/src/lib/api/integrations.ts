import { api } from "./client";
export const integrationsApi = {
  list: api.listIntegrations.bind(api),
  google: api.getGoogleIntegration.bind(api),
  startGoogle: api.startGoogleIntegration.bind(api),
  disconnectGoogle: api.disconnectGoogle.bind(api),
  gmail: api.listGmailMessages.bind(api),
  gmailMessage: api.getGmailMessage.bind(api),
  drive: api.listDriveFiles.bind(api),
  driveFile: api.getDriveFile.bind(api),
  // GitHub
  githubStatus: api.getGitHubStatus.bind(api),
  githubConnect: api.startGitHubConnect.bind(api),
  githubDisconnect: api.disconnectGitHub.bind(api),
  githubTest: api.testGitHubConnection.bind(api),
  githubRepositories: api.listGitHubRepositories.bind(api),
  // Web search
  webSearchStatus: api.getWebSearchStatus.bind(api),
  webSearch: api.webSearch.bind(api),
  webSearchRead: api.webSearchRead.bind(api),
};

