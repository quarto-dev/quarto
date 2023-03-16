declare module 'markdown-it-sup' {
    import MarkdownIt = require('markdown-it');
  
    namespace markdownItSup {
      function sup_plugin(md: MarkdownIt): void;
    }
  
    const MarkdownItSup: typeof markdownItSup.sup_plugin;
    export = MarkdownItSup;
  }