-- Bootstrap script run by the postgres image on first boot.
-- Creates the two databases SubterraDB needs:
--   kong              -- Kong's gateway storage (managed by `kong migrations bootstrap`)
--   subterradb_system -- Control plane: users, projects, members, sessions
CREATE DATABASE kong;
CREATE DATABASE subterradb_system;
