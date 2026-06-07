import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { Buffer } from 'node:buffer';
import { defineConfig, loadEnv, type Plugin } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = env.VITE_DEEPSEEK_PROXY_TARGET || 'https://api.deepseek.com';

  return {
    root: resolve(__dirname, 'src/renderer'),
    envDir: __dirname,
    plugins: [react(), deepSeekDevProxy(proxyTarget, env.VITE_DEEPSEEK_API_KEY)],
    build: {
      outDir: resolve(__dirname, 'dist'),
      emptyOutDir: true
    }
  };
});

function deepSeekDevProxy(proxyTarget: string, apiKey?: string): Plugin {
  return {
    name: 'vibeos-deepseek-dev-proxy',
    configureServer(server) {
      installDeepSeekMiddleware(server.middlewares, proxyTarget, apiKey);
    },
    configurePreviewServer(server) {
      installDeepSeekMiddleware(server.middlewares, proxyTarget, apiKey);
    }
  };
}

function installDeepSeekMiddleware(
  middlewares: { use(route: string, handler: (req: NodeJS.ReadableStream & { url?: string; method?: string; headers: Record<string, string | string[] | undefined> }, res: { statusCode: number; setHeader(name: string, value: string): void; end(body?: string | Uint8Array): void }) => void): void },
  proxyTarget: string,
  apiKey?: string
): void {
  middlewares.use('/deepseek-api', async (req, res) => {
    try {
      const targetUrl = new URL(req.url ?? '/', proxyTarget);
      const body = await readRequestBody(req);
      const response = await fetch(targetUrl, {
        method: req.method,
        headers: {
          Authorization: String(req.headers.authorization ?? (apiKey ? `Bearer ${apiKey}` : '')),
          'Content-Type': String(req.headers['content-type'] ?? 'application/json')
        },
        body: body ? new Uint8Array(body) : undefined
      });

      res.statusCode = response.status;
      const contentType = response.headers.get('content-type');
      if (contentType) {
        res.setHeader('content-type', contentType);
      }
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.statusCode = 502;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }
  });
}

async function readRequestBody(req: NodeJS.ReadableStream): Promise<Buffer | undefined> {
  const chunks: Buffer[] = [];
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return chunks.length ? Buffer.concat(chunks) : undefined;
}
