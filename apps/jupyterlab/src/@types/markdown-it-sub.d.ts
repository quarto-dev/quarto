declare module 'markdown-it-sub' {
    import MarkdownIt = require('markdown-it');
  
    namespace markdownItSub {
      function sub_plugin(md: MarkdownIt): void;
    }
  
    const MarkdownItSub: typeof markdownItSub.sub_plugin;
    export = MarkdownItSub;
  }