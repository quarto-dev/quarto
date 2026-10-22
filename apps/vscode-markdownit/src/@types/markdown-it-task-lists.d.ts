declare module 'markdown-it-task-lists' {
  import type { MarkdownIt } from 'markdown-it';

  const taskListsPlugin: (md: MarkdownIt, options?: { enabled?: boolean; label?: boolean; labelAfter?: boolean }) => void;
  export default taskListsPlugin;
}
