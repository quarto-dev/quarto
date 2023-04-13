declare module 'markdown-it-task-lists' {
    import MarkdownIt = require('markdown-it');
  
    namespace markdownItTaskLists {
      function tasklists_plugin(md: MarkdownIt): void;
    }
  
    const MarkdownItTaskLists: typeof markdownItTaskLists.tasklists_plugin;
    export = MarkdownItTaskLists;
  }