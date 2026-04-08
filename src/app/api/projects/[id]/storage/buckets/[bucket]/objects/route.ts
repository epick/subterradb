import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { listObjects, uploadObject } from '@/server/storage';

// GET /api/projects/[id]/storage/buckets/[bucket]/objects?prefix=foo/
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; bucket: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  const { id, bucket } = await context.params;
  const prefix = new URL(request.url).searchParams.get('prefix') ?? '';
  try {
    const objects = await listObjects(user, id, bucket, prefix);
    return NextResponse.json({ objects });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'storage.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}

// POST /api/projects/[id]/storage/buckets/[bucket]/objects
// Multipart upload — `file` field is the file payload, `name` is the object name.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; bucket: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  const { id, bucket } = await context.params;

  const form = await request.formData();
  const file = form.get('file');
  const name = form.get('name');
  if (!(file instanceof File) || typeof name !== 'string' || !name) {
    return NextResponse.json({ code: 'storage.invalid_body' }, { status: 400 });
  }

  try {
    const buf = await file.arrayBuffer();
    await uploadObject(user, id, bucket, name, buf, file.type || 'application/octet-stream');
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'storage.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
