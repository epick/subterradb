import Docker from 'dockerode';
import { getCurrentUser } from '@/server/auth';
import { query } from '@/server/db';

// GET /api/projects/[id]/logs/[container]
//
// Streams docker container logs as Server-Sent Events. The browser opens an
// EventSource against this endpoint and receives one event per log line.
// Container is restricted to one of {postgrest, gotrue, storage} for the
// requested project — anything else returns 404.

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

const ALLOWED_ROLES = ['postgrest', 'gotrue', 'storage'] as const;
type Role = (typeof ALLOWED_ROLES)[number];

function containerNameFor(role: Role, slug: string): string {
  return `${role}_${slug}`;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; container: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return new Response(JSON.stringify({ code: 'auth.unauthenticated' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  const { id, container } = await context.params;

  if (!(ALLOWED_ROLES as readonly string[]).includes(container)) {
    return new Response(JSON.stringify({ code: 'logs.invalid_container' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }

  // Resolve project + RBAC.
  const r = await query<{ slug: string }>(`SELECT slug FROM projects WHERE id = $1`, [id]);
  const project = r.rows[0];
  if (!project) {
    return new Response(JSON.stringify({ code: 'projects.not_found' }), {
      status: 404,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (user.role !== 'admin') {
    const access = await query(
      `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [id, user.id],
    );
    if (access.rowCount === 0) {
      return new Response(JSON.stringify({ code: 'projects.forbidden' }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      });
    }
  }

  const containerName = containerNameFor(container as Role, project.slug);

  // Stream the logs as Server-Sent Events. Each chunk from dockerode becomes
  // one or more `data:` lines.
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let dockerStream: NodeJS.ReadableStream | null = null;
      let closed = false;

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          (dockerStream as { destroy?: () => void } | null)?.destroy?.();
        } catch {}
        try {
          controller.close();
        } catch {}
      };

      try {
        const c = docker.getContainer(containerName);
        dockerStream = (await c.logs({
          follow: true,
          stdout: true,
          stderr: true,
          tail: 200,
          timestamps: false,
        })) as NodeJS.ReadableStream;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`event: error\ndata: ${msg}\n\n`));
        close();
        return;
      }

      // Initial ping so the browser EventSource opens immediately.
      controller.enqueue(encoder.encode(`: connected to ${containerName}\n\n`));

      // Docker's multiplexed log stream wraps EVERY frame in an 8-byte header:
      //   byte 0   : stream type (1=stdout, 2=stderr)
      //   bytes 1-3: padding
      //   bytes 4-7: payload length (big-endian uint32)
      // We accumulate bytes across chunk boundaries and demux frame by frame.
      let buffered = Buffer.alloc(0);

      dockerStream!.on('data', (chunk: Buffer) => {
        buffered = Buffer.concat([buffered, chunk]);

        const lines: string[] = [];
        while (buffered.length >= 8) {
          const streamType = buffered[0];
          // Heuristic: if the first byte isn't 1 or 2, the container is in
          // tty mode and there's no header — flush the buffer as plain text.
          if (streamType !== 1 && streamType !== 2) {
            lines.push(buffered.toString('utf8'));
            buffered = Buffer.alloc(0);
            break;
          }
          const length = buffered.readUInt32BE(4);
          if (buffered.length < 8 + length) {
            // Frame is split across chunks — wait for more data.
            break;
          }
          const payload = buffered.subarray(8, 8 + length);
          lines.push(payload.toString('utf8'));
          buffered = buffered.subarray(8 + length);
        }

        // Each newline becomes a separate SSE `data:` line.
        for (const text of lines) {
          for (const line of text.split('\n')) {
            if (line.length === 0) continue;
            const safe = line.replace(/\r/g, '');
            controller.enqueue(encoder.encode(`data: ${safe}\n\n`));
          }
        }
      });

      dockerStream!.on('end', close);
      dockerStream!.on('error', close);
    },
    cancel() {
      // Browser disconnected — nothing else to do, the docker stream is
      // tied to the controller above and will be GC'd.
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
