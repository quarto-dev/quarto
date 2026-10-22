declare module 'markdown-it-deflist' {
  import type { MarkdownIt } from 'markdown-it';

  const deflistPlugin: (md: MarkdownIt) => void;
  export default deflistPlugin;
}
