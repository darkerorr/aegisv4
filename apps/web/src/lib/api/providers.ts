import { api } from "./client";
export const providersApi = {
  list: api.listProviders.bind(api),
  create: api.createProvider.bind(api),
  update: api.updateProvider.bind(api),
  remove: api.deleteProvider.bind(api),
  test: api.testProvider.bind(api),
  models: api.listProviderModels.bind(api),
  diagnose: api.diagnoseProvider.bind(api),
  connect: api.connectCloudProvider.bind(api),
  testCloud: api.testCloudProvider.bind(api),
  refreshCloud: api.refreshCloudProviderModels.bind(api),
  disconnectCloud: api.disconnectCloudProvider.bind(api),
};
