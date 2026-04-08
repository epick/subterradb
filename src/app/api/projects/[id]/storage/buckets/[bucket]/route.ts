import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { deleteBucket } from '@/server/storage';

// DELETE /api/projects/[id]/storage/buckets/[bucket]
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; bucket: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  const { id, bucket } = await context.params;
  try {
    await deleteBucket(user, id, bucket);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'storage.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
