declare module 'markdown-it-sup' {
  import type { MarkdownIt } from 'markdown-it';

  const supPlugin: (md: MarkdownIt) => void;
  export default supPlugin;
}
