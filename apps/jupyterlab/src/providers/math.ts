/*
* math.ts
*
* Copyright (C) 2020-2023 Posit Software, PBC
*
*/
import { mathjaxPlugin } from '../plugins/math';
import { markdownItExtension } from './provider';

export const math = markdownItExtension({
  id: '@quarto/math',
  title: 'LaTex Math',
  plugin: async () => {
    return [mathjaxPlugin];
  },
  hooks: {
    postRender: {
      run: (node: HTMLElement) => {

        // Inject mathjax
        const mathjaxId = "MathJax-script";
        const mathJaxScript = document.getElementById(mathjaxId);
        if (!mathJaxScript) {

          const configEl = document.createElement("script");
          configEl.innerText = `

MathJax = {
  svg: {
    fontCache: 'global'
  },
  startup: {
    typeset: false,
    pageReady: () => {
      MathJax.startup.promise.then(() => {
        
        const typesetMath = (el) => {
          const mathEls = el.querySelectorAll('.quarto-inline-math, .quarto-display-math');
          if (mathEls.length > 0) {
            MathJax.startup.promise = MathJax.startup.promise.then(() => { console.log("Typeset " + mathEls.length ); MathJax.typesetPromise([...mathEls])} ).catch((err) => console.log('Typeset failed: ' + err.message));
            return MathJax.startup.promise;  
          } else {
            return Promise.resolve();
          }
        };
        
        typesetMath(document.body).then(() => {
          const nbObserver = new MutationObserver((mutationList, observer) => {
            mutationList.forEach((mutation) => { 
              mutation.addedNodes.forEach((addedNode) => {
                if (addedNode.nodeType === 1) {
                  typesetMath(addedNode);
                }
              });
            });
          });
          
          const nbEl = document.querySelector('.jp-Notebook');
          nbObserver.observe(nbEl, { 
            childList: true,
            subtree: true
          });
        });
      });
    },
  }
};`;
          document.head.appendChild(configEl);
          

          const polyFillEl = document.createElement("script");
          polyFillEl.setAttribute("src", "https://polyfill.io/v3/polyfill.min.js?features=es6");
          document.head.appendChild(polyFillEl);

          const scriptEl = document.createElement("script");
          scriptEl.id = mathjaxId;
          scriptEl.setAttribute("src", "https://cdn.jsdelivr.net/npm/mathjax@3.0.1/es5/tex-mml-chtml.js");
          document.head.appendChild(scriptEl);
        }

        return Promise.resolve();
      }
    }
  }
});

/*
<script src="https://polyfill.io/v3/polyfill.min.js?features=es6"></script>
<script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>

*/