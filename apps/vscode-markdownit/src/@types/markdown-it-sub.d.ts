declare module 'markdown-it-sub' {
  import type { MarkdownIt } from 'markdown-it';

  const subPlugin: (md: MarkdownIt) => void;
  export default subPlugin;
}
