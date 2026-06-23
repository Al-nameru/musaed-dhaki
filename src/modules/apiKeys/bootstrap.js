import { collectApiKeyRefs } from "./domRefs.js";
import { createApiKeyVerificationController } from "./verificationController.js";

export function createApiKeyVerificationBootstrap(deps) {
  let requestId = 0;

  const bumpRequest = () => {
    requestId += 1;
    return requestId;
  };

  return {
    ...createApiKeyVerificationController({
      invoke: deps.invoke,
      addAppAlert: deps.addAppAlert,
      cacheProviderModels: deps.cacheProviderModels,
      saveProviderKey: deps.saveProviderKey,
      getRefs: collectApiKeyRefs,
      bumpApiKeyVerificationRequest: bumpRequest,
      getApiKeyVerificationRequestId: () => requestId,
      getFreeSttEngine: deps.getFreeSttEngine,
      setFreeSttEngineState: deps.setFreeSttEngineState,
      setActiveApiKey: deps.setActiveApiKey,
      setActiveProvider: deps.setActiveProvider,
      setSpeechModel: deps.setSpeechModel,
      getDiacritizeProvider: deps.getDiacritizeProvider,
      populateModels: deps.populateModels,
      populateDiacritizeModels: deps.populateDiacritizeModels,
      updateHomeIndicators: deps.updateHomeIndicators,
      refreshModelComparisonOptions: deps.refreshModelComparisonOptions
    }),
    bumpRequest
  };
}
