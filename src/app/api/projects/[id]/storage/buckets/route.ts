import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { createBucket, listBuckets } from '@/server/storage';

// GET /api/projects/[id]/storage/buckets
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  const { id } = await context.params;
  try {
    const buckets = await listBuckets(user, id);
    return NextResponse.json({ buckets });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'storage.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}

// POST /api/projects/[id]/storage/buckets
// Body: { name: string, public?: boolean }
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  const { id } = await context.params;
  let body: { name?: unknown; public?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'storage.invalid_body' }, { status: 400 });
  }
  if (typeof body.name !== 'string') {
    return NextResponse.json({ code: 'storage.invalid_body' }, { status: 400 });
  }
  try {
    const bucket = await createBucket(user, id, body.name, body.public === true);
    return NextResponse.json({ bucket }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'storage.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
