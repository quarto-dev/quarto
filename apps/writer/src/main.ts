import "./style.css";
import typescriptLogo from "./typescript.svg";


import { UITools } from "editor";


const uiTools = new UITools();

console.log(uiTools.attr.pandocAutoIdentifier('here we all go'));


const editorServer = uiTools.context.jsonRpcServer('/editor-server');
editorServer.pandoc.getCapabilities().then(console.log);


document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
  </div>
`;
