declare module 'markdown-it-implicit-figures' {
    import MarkdownIt = require('markdown-it');
  
    namespace markdownItImplicitFigures {
      function implicit_figure_plugin(md: MarkdownIt): void;
    }
  
    const MarkdownItImplicitFigures: typeof markdownItImplicitFigures.implicit_figure_plugin;
    export = MarkdownItImplicitFigures;
  }