declare module '*.png';
declare module '*.gif';
declare module '*.json';
declare module '*.css';

// Vite replaces import.meta.env.MODE with the build mode
interface ImportMetaEnv {
  readonly MODE: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
