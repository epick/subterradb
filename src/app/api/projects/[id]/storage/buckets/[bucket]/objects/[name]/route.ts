import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { deleteObject } from '@/server/storage';

// DELETE /api/projects/[id]/storage/buckets/[bucket]/objects/[name]
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; bucket: string; name: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  const { id, bucket, name } = await context.params;
  try {
    await deleteObject(user, id, bucket, decodeURIComponent(name));
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'storage.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
