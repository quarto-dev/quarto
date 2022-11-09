import "./style.css";
import typescriptLogo from "./typescript.svg";

import { createEditor } from "./editor";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div>
    <a href="https://vitejs.dev" target="_blank">
      <img src="/vite.svg" class="logo" alt="Vite logo" />
    </a>
    <a href="https://www.typescriptlang.org/" target="_blank">
      <img src="${typescriptLogo}" class="logo vanilla" alt="TypeScript logo" />
    </a>
    <EditorDiv />
  </div>
`;


const editorDiv = document.querySelector<HTMLElement>("#editor");
if (editorDiv) {
  await createEditor(editorDiv);
}

