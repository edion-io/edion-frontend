// Config utilities for API base URL and URL construction

export function getApiBaseUrl(): string {
  // Resolve API base URL from environment; provide a dev fallback and throw in prod
  type ViteEnv = { MODE?: string; VITE_API_URL?: string; NEXT_PUBLIC_API_URL?: string; REACT_APP_API_URL?: string };
  const viteEnv: ViteEnv = (typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: ViteEnv }).env : undefined) || {};
  const mode: string = viteEnv.MODE || 'development';

  const fromVite: string | undefined = viteEnv.VITE_API_URL;
  const fromNextPublicVite: string | undefined = viteEnv.NEXT_PUBLIC_API_URL; // non-standard in Vite but supported if injected
  const fromReactApp: string | undefined = viteEnv.REACT_APP_API_URL;
  // During some build/test contexts, process.env may be defined
   
  const fromProcess: string | undefined = (typeof process !== 'undefined' && (process as unknown as { env?: Record<string, string | undefined> }).env)
    ? ((process as unknown as { env: Record<string, string | undefined> }).env.VITE_API_URL
      || (process as unknown as { env: Record<string, string | undefined> }).env.NEXT_PUBLIC_API_URL
      || (process as unknown as { env: Record<string, string | undefined> }).env.REACT_APP_API_URL)
    : undefined;

  const base: string | undefined = fromVite || fromNextPublicVite || fromReactApp || fromProcess;

  if (!base) {
    if (mode === 'development' || mode === 'test') {
      return 'http://127.0.0.1:5057';
    }
    throw new Error('Missing API base URL. Set VITE_API_URL (or NEXT_PUBLIC_API_URL / REACT_APP_API_URL).');
  }

  return base.replace(/\/+$/, '');
}

export function joinUrl(baseUrl: string, path: string): string {
  const left = baseUrl.replace(/\/+$/, '');
  const right = path.replace(/^\/+/, '');
  return `${left}/${right}`;
}


