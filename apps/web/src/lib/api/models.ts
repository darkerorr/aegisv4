import { api } from "./client";
export const modelsApi = { list: api.listModels.bind(api), refresh: api.listModelsRefresh.bind(api), update: api.updateModel.bind(api) };
