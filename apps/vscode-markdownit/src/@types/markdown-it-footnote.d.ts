declare module 'markdown-it-footnote' {
  import type { MarkdownIt } from 'markdown-it';

  const footnotePlugin: (md: MarkdownIt) => void;
  export default footnotePlugin;
}
