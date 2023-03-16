declare module 'markdown-it-gridtables' {
    import MarkdownIt = require('markdown-it');
  
    namespace markdownItGridTables {
      function gridtables_plugin(md: MarkdownIt): void;
    }
  
    const MarkdownGridTables: typeof markdownItGridTables.gridtables_plugin;
    export = MarkdownGridTables;
  }