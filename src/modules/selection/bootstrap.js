import { collectSelectionToolRefs } from "./domRefs.js";
import { createSelectionTools } from "./toolsController.js";

export function createSelectionToolsFromDocument(deps) {
  return createSelectionTools(collectSelectionToolRefs(), deps);
}
