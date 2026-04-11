'use client';

import { useState } from 'react';
import { Check, Copy, Plug, Terminal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

interface McpConfigCardProps {
  /** Project slug — used in the snippet's variable values. */
  projectSlug: string;
  /** Service role key for this project (full string). */
  serviceKey: string;
  /** Pre-built Postgres connection string for the project's database. */
  dbUrl: string;
  /** Pre-built gateway URL with the project slug appended. */
  projectUrl: string;
}

// Editor presets — each one knows where its MCP config file lives so the
// developer can paste the snippet into the right place. The schema is the
// same across editors (it's the MCP standard), only the file path changes.
const EDITORS = [
  {
    key: 'cursor',
    label: 'Cursor',
    file: '.cursor/mcp.json',
    note: 'In the root of your project. Cursor reloads the config automatically.',
  },
  {
    key: 'claude-code',
    label: 'Claude Code',
    file: '~/.claude.json',
    note: 'Global Claude Code config. Restart claude-code after editing.',
  },
  {
    key: 'claude-desktop',
    label: 'Claude Desktop',
    file: '~/Library/Application Support/Claude/claude_desktop_config.json',
    note: 'macOS path. Restart Claude Desktop after editing.',
  },
  {
    key: 'cline',
    label: 'VS Code (Cline)',
    file: '~/Library/Application Support/Code/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json',
    note: 'Cline auto-reloads when the file changes.',
  },
  {
    key: 'windsurf',
    label: 'Windsurf',
    file: '~/.codeium/windsurf/mcp_config.json',
    note: 'Restart Windsurf after editing.',
  },
] as const;

type EditorKey = (typeof EDITORS)[number]['key'];

// "Copy MCP config" card on the project detail page. Generates a ready-to-paste
// JSON snippet with the project's real env vars. The snippet uses
// `npx -y @subterradb/mcp-server` so the developer needs ZERO local install —
// the first time their editor launches the MCP, npm fetches the package and
// runs it. The card runs on the developer's laptop, never on the SubterraDB
// host, so there's no path to a local file involved.
export function McpConfigCard({
  projectSlug,
  serviceKey,
  dbUrl,
  projectUrl,
}: McpConfigCardProps) {
  const t = useTranslations('projects.mcp');
  const [editor, setEditor] = useState<EditorKey>('cursor');
  const [copied, setCopied] = useState(false);

  const config = buildMcpConfig({
    serverName: `subterradb-${projectSlug}`,
    projectUrl,
    serviceKey,
    dbUrl,
  });

  const onCopy = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(config);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = config;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard unavailable — silently fail.
    }
  };

  const activeEditor = EDITORS.find((e) => e.key === editor)!;

  return (
    <section className="overflow-hidden rounded-2xl border border-border/60 bg-card/60 shadow-2xl shadow-black/30 backdrop-blur-xl">
      <header className="flex items-center justify-between border-b border-border/40 px-6 py-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 items-center justify-center rounded-xl border border-[color:var(--color-brand-from)]/30 bg-[color:var(--color-brand-from)]/10">
            <Plug className="size-4 text-[color:var(--color-brand-from)]" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-foreground">{t('title')}</h2>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </div>
        </div>
      </header>

      <div className="space-y-4 px-6 py-5">
        {/* Editor picker tabs */}
        <div className="flex flex-wrap gap-2">
          {EDITORS.map((e) => (
            <button
              key={e.key}
              type="button"
              onClick={() => setEditor(e.key)}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-all',
                editor === e.key
                  ? 'border-[color:var(--color-brand-from)]/50 bg-[color:var(--color-brand-from)]/10 text-foreground'
                  : 'border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground',
              )}
            >
              {e.label}
            </button>
          ))}
        </div>

        {/* Where to paste it */}
        <div className="rounded-lg border border-border/40 bg-background/40 px-4 py-3">
          <p className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
            {t('pasteIn')}
          </p>
          <p className="mt-1 truncate font-mono text-xs text-foreground">
            {activeEditor.file}
          </p>
          <p className="mt-1 text-[0.65rem] text-muted-foreground">{activeEditor.note}</p>
        </div>

        {/* Code block */}
        <div className="relative overflow-hidden rounded-lg border border-border/60 bg-[#0f0f12]">
          <pre className="max-h-[360px] overflow-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-foreground/90">
            <code>{config}</code>
          </pre>
          <button
            type="button"
            onClick={onCopy}
            className={cn(
              'absolute right-2 top-2 inline-flex items-center gap-1.5 rounded-md border border-border/60 bg-card/80 px-2.5 py-1 text-[0.65rem] font-medium backdrop-blur-xl transition-colors',
              copied
                ? 'border-emerald-500/40 text-emerald-300'
                : 'text-muted-foreground hover:border-[color:var(--color-brand-from)]/50 hover:text-foreground',
            )}
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? t('copied') : t('copy')}
          </button>
        </div>

        {/* Test command */}
        <details className="rounded-lg border border-border/40 bg-background/40 px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Terminal className="size-3.5" />
            {t('testTitle')}
          </summary>
          <p className="mt-2 text-[0.65rem] text-muted-foreground">{t('testDescription')}</p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-[#0f0f12] px-3 py-2 font-mono text-[10px] leading-relaxed text-foreground/85">
            <code>{buildTestCommand({ projectUrl, serviceKey, dbUrl })}</code>
          </pre>
        </details>

        {/* Manual install fallback — for offline / locked-down dev machines */}
        <details className="rounded-lg border border-border/40 bg-background/40 px-4 py-3">
          <summary className="flex cursor-pointer items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <Terminal className="size-3.5" />
            {t('manualTitle')}
          </summary>
          <p className="mt-2 text-[0.65rem] leading-relaxed text-muted-foreground">
            {t('manualDescription')}
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-[#0f0f12] px-3 py-2 font-mono text-[10px] leading-relaxed text-foreground/85">
            <code>{`git clone https://github.com/epick/subterradb.git
cd subterradb/packages/mcp-server
npm install && npm run build

# then in your MCP config, replace the snippet's
# "command": "npx", "args": ["-y", "@subterradb/mcp-server"]
# with:
# "command": "node",
# "args": ["/absolute/path/to/subterradb/packages/mcp-server/dist/index.js"]`}</code>
          </pre>
        </details>
      </div>
    </section>
  );
}

interface ConfigInput {
  serverName: string;
  projectUrl: string;
  serviceKey: string;
  dbUrl: string;
}

// Generates the canonical mcp.json snippet. The MCP-standard schema is the
// same across editors, so this single string works as-is for Cursor / Claude
// Code / Cline / Windsurf — only the destination file path changes.
//
// Uses `npx -y @subterradb/mcp-server` so the developer needs zero local
// install: the first time their editor launches the MCP, npm fetches the
// package and runs it. Subsequent launches use the cached copy.
function buildMcpConfig({
  serverName,
  projectUrl,
  serviceKey,
  dbUrl,
}: ConfigInput): string {
  // Explicit -p PACKAGE BIN form. This is more robust than the shorter
  // `npx -y @subterradb/mcp-server` because npx's auto bin-name resolution
  // for scoped packages is inconsistent across npm versions — the explicit
  // form always works.
  const config = {
    mcpServers: {
      [serverName]: {
        command: 'npx',
        args: ['-y', '--package=@subterradb/mcp-server', 'mcp-server'],
        env: {
          SUBTERRADB_URL: projectUrl,
          SUBTERRADB_SERVICE_KEY: serviceKey,
          SUBTERRADB_DB_URL: dbUrl,
        },
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

// One-liner the developer can run from a terminal to confirm the MCP server
// boots and answers `tools/list` correctly with their project's credentials.
function buildTestCommand({
  projectUrl,
  serviceKey,
  dbUrl,
}: Omit<ConfigInput, 'serverName'>): string {
  return `echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | \\
  SUBTERRADB_URL="${projectUrl}" \\
  SUBTERRADB_SERVICE_KEY="${serviceKey.slice(0, 24)}..." \\
  SUBTERRADB_DB_URL="${dbUrl}" \\
  npx -y --package=@subterradb/mcp-server mcp-server`;
}
