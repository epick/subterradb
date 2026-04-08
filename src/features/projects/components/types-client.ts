// Client-safe view of a project with its connection details.
// Mirrors the server-side ProjectWithKeys but lives here so client components
// can import it without pulling in any node-only modules.
import type { Project } from '../types';

export interface ProjectWithKeys extends Project {
  jwtSecret: string;
  anonKey: string;
  serviceKey: string;
  dbPassword: string;
  members: Array<{ id: string; name: string; email: string }>;
}
