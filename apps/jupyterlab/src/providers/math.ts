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

        const typesetMath = (els) => {
          MathJax.startup.promise = MathJax.startup.promise
            .then(() => {
              return MathJax.typesetPromise(els); }
            )
            .catch((err) => console.log('Typeset failed: ' + err.message));
          return MathJax.startup.promise;
        };
        
        const typesetCellObserver = new MutationObserver((mutationList, observer) => { 
          const els = mutationList.map((list) => list.target);          
          const typesetEls = [];
          for (const el of els) {
            const childMathEls = el.querySelectorAll('.quarto-inline-math, .quarto-display-math');
            if (childMathEls && childMathEls.length > 0) {
              typesetEls.push(...childMathEls);
            }
          }
          typesetMath(typesetEls);
        });        

        const containerObserver = new MutationObserver((mutationList, observer) => { 
          const nodes = [];
          mutationList.forEach((record) => {
            for (const node of record.addedNodes) {
              nodes.push(node);
            }
          });

          const markdownNodes = nodes.filter((node) => {
            return node.class.contains("jp-MarkdownCell");
          }).forEach((node) => {
            typesetCellObserver.observe(node, { childList: true, subtree: true });
          });
          
        });

        const nbContainer = document.querySelector('.jp-Notebook');
        if (nbContainer !== null) {
          containerObserver.observe(nbContainer, { childList: true });
        }

        const mathEls = document.body.querySelectorAll('.quarto-inline-math, .quarto-display-math');
        return typesetMath([...mathEls]).then(() => {
          for (const mathEl of mathEls) {
            typesetCellObserver.observe(mathEl.parentElement, { childList: true, subtree: true });
          }    
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