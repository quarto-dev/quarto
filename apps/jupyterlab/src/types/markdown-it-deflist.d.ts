declare module 'markdown-it-deflist' {
    import MarkdownIt = require('markdown-it');
  
    namespace markdownItDefList {
      function deflist_plugin(md: MarkdownIt): void;
    }
  
    const MarkdownItDefList: typeof markdownItDefList.deflist_plugin;
    export = MarkdownItDefList;
  }