// Domain types for SubterraDB members.
// Mirrors the shape returned by /api/members (and src/server/members.ts).

export type MemberRole = 'admin' | 'developer';
export type MemberStatus = 'active' | 'pending' | 'disabled';

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  status: MemberStatus;
  /** ISO timestamp of last sign-in / API call. Null if never seen. */
  lastActiveAt: string | null;
  /** ISO timestamp of when the user joined. */
  joinedAt: string;
  /** Number of projects this member has access to. Admins see all. */
  projectsCount: number;
}
