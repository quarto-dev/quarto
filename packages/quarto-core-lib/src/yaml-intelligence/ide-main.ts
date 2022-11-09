import { getLocalPath, setMainPath } from "./paths.js";
import { Callable, clientStubs } from "./web-worker-manager.js";
import { YamlIntelligenceContext } from "./types.js";

let stubs: Record<string, Callable> | undefined;

function ensureStubs(path: string) {
  if (stubs) {
    return;
  }
  setMainPath(path);

  const worker = new (globalThis as any).Worker(getLocalPath("web-worker.js"));
  stubs = clientStubs(["getCompletions", "getLint"], worker);
}

export const QuartoYamlEditorTools = {
  // helpers to facilitate repro'ing in the browser
  // getAutomation: function (
  //   params: { context: YamlIntelligenceContext; kind: AutomationKind },
  // ) {
  //   const {
  //     context,
  //     kind,
  //   } = params;
  //   return getAutomation(kind, context);
  // },
  // exportSmokeTest,

  // entry points required by the IDE
  getCompletions: async function (
    context: YamlIntelligenceContext,
    path: string,
  ) {
    ensureStubs(path);
    return await stubs!["getCompletions"](context, path);
  },

  getLint: async function (
    context: YamlIntelligenceContext,
    path: string,
  ) {
    ensureStubs(path);
    return await stubs!["getLint"](context, path);
  },
};
