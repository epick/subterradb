import { hashPassword } from './auth';
import { query } from './db';
import type { SessionUser } from './auth';

// Members service — CRUD over the platform_users table.
// All mutations require the caller to be an admin.

export type MemberRole = 'admin' | 'developer';
export type MemberStatus = 'active' | 'pending' | 'disabled';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  lastActiveAt: string | null;
  joinedAt: string;
  projectsCount: number;
}

interface MemberRow {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  last_active_at: Date | null;
  created_at: Date;
  projects_count: string;
}

function rowToMember(row: MemberRow): Member {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    lastActiveAt: row.last_active_at?.toISOString() ?? null,
    joinedAt: row.created_at.toISOString(),
    projectsCount: Number(row.projects_count),
  };
}

function assertAdmin(actor: SessionUser): void {
  if (actor.role !== 'admin') {
    throw Object.assign(new Error('Only admins can manage members'), {
      code: 'members.forbidden',
      status: 403,
    });
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export async function listMembers(actor: SessionUser): Promise<Member[]> {
  assertAdmin(actor);

  const result = await query<MemberRow>(
    `SELECT u.id, u.name, u.email, u.role, u.status, u.last_active_at, u.created_at,
            COALESCE(c.cnt, 0)::text AS projects_count
     FROM platform_users u
     LEFT JOIN (
       SELECT user_id, count(*) AS cnt
       FROM project_members
       GROUP BY user_id
     ) c ON c.user_id = u.id
     ORDER BY
       CASE WHEN u.role = 'admin' THEN 0 ELSE 1 END,
       u.created_at ASC`,
  );
  return result.rows.map(rowToMember);
}

// ---------------------------------------------------------------------------
// Invite (create pending member)
// ---------------------------------------------------------------------------

export interface InviteMemberInput {
  email: string;
  name: string;
  role: MemberRole;
  /** Initial password — required because we don't have email delivery yet. */
  password: string;
}

export async function inviteMember(
  actor: SessionUser,
  input: InviteMemberInput,
): Promise<Member> {
  assertAdmin(actor);

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) {
    throw Object.assign(new Error('Email and name are required'), {
      code: 'members.missing_fields',
      status: 400,
    });
  }
  if (input.role !== 'admin' && input.role !== 'developer') {
    throw Object.assign(new Error('Invalid role'), {
      code: 'members.invalid_role',
      status: 400,
    });
  }
  if (!input.password || input.password.length < 8) {
    throw Object.assign(new Error('Password must be at least 8 characters'), {
      code: 'members.password_too_short',
      status: 400,
    });
  }

  const existing = await query(`SELECT 1 FROM platform_users WHERE lower(email) = $1`, [email]);
  if (existing.rowCount! > 0) {
    throw Object.assign(new Error('A member with this email already exists'), {
      code: 'members.email_taken',
      status: 409,
    });
  }

  const passwordHash = await hashPassword(input.password);
  const inserted = await query<MemberRow>(
    `INSERT INTO platform_users (email, name, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING id, name, email, role, status, last_active_at, created_at,
               '0'::text AS projects_count`,
    [email, name, passwordHash, input.role],
  );
  return rowToMember(inserted.rows[0]);
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function removeMember(actor: SessionUser, memberId: string): Promise<void> {
  assertAdmin(actor);

  // Don't let admins delete themselves — that would lock out the instance.
  if (memberId === actor.id) {
    throw Object.assign(new Error('Cannot remove your own account'), {
      code: 'members.cannot_remove_self',
      status: 400,
    });
  }

  // Don't let admins delete the last remaining admin.
  const isLastAdmin = await query<{ cnt: string }>(
    `SELECT count(*)::text AS cnt FROM platform_users WHERE role = 'admin' AND status = 'active'`,
  );
  const target = await query<{ role: string }>(`SELECT role FROM platform_users WHERE id = $1`, [
    memberId,
  ]);
  if (target.rows[0]?.role === 'admin' && Number(isLastAdmin.rows[0].cnt) <= 1) {
    throw Object.assign(new Error('Cannot remove the last admin'), {
      code: 'members.cannot_remove_last_admin',
      status: 400,
    });
  }

  await query(`DELETE FROM platform_users WHERE id = $1`, [memberId]);
}
