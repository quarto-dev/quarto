declare module 'markdown-it-footnote' {
    import MarkdownIt = require('markdown-it');
  
    namespace markdownItFootnote {
      function footnote_plugin(md: MarkdownIt): void;
    }
  
    const MarkdownItFootnote: typeof markdownItFootnote.footnote_plugin;
    export = MarkdownItFootnote;
  }