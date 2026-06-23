import {
  getComparisonModels,
  getComparisonProviders,
  getProviderKey,
  getProviderKeysList
} from "../modules/ai/providerModels.js";
import { createModelComparisonController } from "../modules/modelCompare/controller.js";

export function createModelComparisonRuntime(deps) {
  const runtime = createModelComparisonController({
    invoke: deps.invoke,
    getErrorMessage: deps.getErrorMessage,
    getComparisonProviders: () => getComparisonProviders({
      activeProvider: deps.getActiveProvider(),
      activeApiKey: deps.getActiveApiKey()
    }),
    getComparisonKeys: getProviderKeysList,
    getComparisonModels,
    getProviderKey: (provider) => getProviderKey(provider, {
      activeProvider: deps.getActiveProvider(),
      activeApiKey: deps.getActiveApiKey()
    })
  });

  return {
    setStatus: runtime.setStatus,
    applyCurrentLayout: runtime.applyCurrentLayout,
    setup: runtime.setup,
    refreshOptions: runtime.refreshOptions,
    renderAttachments: runtime.renderAttachments,
    abort: runtime.abort
  };
}
