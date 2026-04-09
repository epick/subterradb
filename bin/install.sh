#!/usr/bin/env bash
# =============================================================================
# SubterraDB — one-shot installer
# =============================================================================
# Usage:  ./bin/install.sh
#
# What it does:
#   1. Verifies docker + docker compose are installed and reachable
#   2. Generates strong secrets (JWT signing + bootstrap admin password) if
#      .env doesn't already have them
#   3. Detects the host's public address and writes it to .env
#   4. Builds the GUI image and brings up the full stack
#   5. Waits until every service is healthy
#   6. Prints a summary with the URL and login credentials
#
# Idempotent: re-runs are safe. Existing secrets in .env are preserved.
# =============================================================================

set -euo pipefail

# Move to the repo root regardless of where the script is invoked from.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$REPO_ROOT"

# Read the version from the VERSION file at the repo root. Used in the
# success banner so the operator knows exactly which release they just
# installed.
SUBTERRADB_VERSION="$(cat VERSION 2>/dev/null || echo 'dev')"

# ----- Output helpers --------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

ok()    { echo -e "${GREEN}✓${RESET} $*"; }
info()  { echo -e "${BLUE}→${RESET} $*"; }
warn()  { echo -e "${YELLOW}!${RESET} $*"; }
err()   { echo -e "${RED}✗${RESET} $*" >&2; }
hdr()   { echo -e "\n${BOLD}━━━ $* ━━━${RESET}"; }

# ----- 1. Dependency checks --------------------------------------------------
hdr "Checking dependencies"

if ! command -v docker &> /dev/null; then
  err "Docker is not installed."
  echo "  Install it from https://docs.docker.com/engine/install/ and re-run this script."
  exit 1
fi
ok "docker installed: $(docker --version | awk '{print $3}' | tr -d ',')"

if ! docker compose version &> /dev/null; then
  err "Docker Compose plugin is not installed."
  echo "  Install it from https://docs.docker.com/compose/install/ and re-run this script."
  exit 1
fi
ok "docker compose installed: $(docker compose version --short)"

if ! docker info &> /dev/null; then
  err "Docker daemon is not reachable. Is the docker service running?"
  echo "  Try: sudo systemctl start docker"
  echo "  Or:  open -a Docker  (on macOS with Docker Desktop)"
  exit 1
fi
ok "docker daemon reachable"

# On Linux, make sure docker.service is enabled in systemd so the daemon
# (and therefore every container marked `restart: unless-stopped`) survives
# a host reboot. The Docker apt/dnf packages usually enable it on install,
# but we double-check defensively. macOS Docker Desktop has its own auto-start
# mechanism, so we skip this branch when systemctl isn't available.
if command -v systemctl &> /dev/null && systemctl list-unit-files docker.service &> /dev/null; then
  if systemctl is-enabled docker.service &> /dev/null; then
    ok "docker.service is enabled at boot"
  else
    warn "docker.service is NOT enabled at boot — enabling it now (may prompt for sudo)"
    if sudo systemctl enable docker.service &> /dev/null; then
      ok "docker.service enabled — stack will survive host reboots"
    else
      warn "failed to enable docker.service automatically"
      warn "run \`sudo systemctl enable docker.service\` manually so the stack"
      warn "comes back up after a host reboot"
    fi
  fi
fi

# Optional but useful: openssl for secret generation. Most distros have it.
if ! command -v openssl &> /dev/null; then
  err "openssl is not installed (needed to generate secrets)."
  echo "  Debian/Ubuntu:  sudo apt-get install -y openssl"
  echo "  macOS:          already bundled with the system"
  exit 1
fi
ok "openssl installed"

# ----- 2. Generate secrets ---------------------------------------------------
hdr "Configuring environment"

ENV_FILE="$REPO_ROOT/.env"

# Helper: read a value from .env, returning empty if missing.
read_env() {
  local key="$1"
  if [[ -f "$ENV_FILE" ]]; then
    grep -E "^${key}=" "$ENV_FILE" | tail -n1 | cut -d'=' -f2- | sed 's/^"//; s/"$//'
  fi
}

# Helper: set a value in .env, replacing if it exists.
set_env() {
  local key="$1"
  local value="$2"
  if [[ -f "$ENV_FILE" ]] && grep -qE "^${key}=" "$ENV_FILE"; then
    # macOS sed and GNU sed differ on -i; use a portable .bak approach.
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

# Bootstrap .env from .env.example if it doesn't exist yet.
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "$REPO_ROOT/.env.example" ]]; then
    cp "$REPO_ROOT/.env.example" "$ENV_FILE"
    ok "created .env from .env.example"
  else
    touch "$ENV_FILE"
    warn "no .env.example found — creating an empty .env"
  fi
fi

# Generate JWT secret if missing or still the placeholder value.
JWT_SECRET="$(read_env SUBTERRADB_JWT_SECRET)"
if [[ -z "$JWT_SECRET" ]] || [[ "$JWT_SECRET" == replace-me-* ]]; then
  JWT_SECRET="$(openssl rand -base64 48 | tr -d '\n')"
  set_env SUBTERRADB_JWT_SECRET "$JWT_SECRET"
  ok "generated SUBTERRADB_JWT_SECRET (48 bytes)"
else
  ok "SUBTERRADB_JWT_SECRET already set — keeping existing value"
fi

# Generate admin password if missing or still the placeholder value.
ADMIN_PWD="$(read_env SUBTERRADB_ADMIN_PASSWORD)"
if [[ -z "$ADMIN_PWD" ]] || [[ "$ADMIN_PWD" == replace-me-* ]]; then
  ADMIN_PWD="$(openssl rand -base64 18 | tr -d '\n=' | tr '/+' '_-' | head -c 24)"
  set_env SUBTERRADB_ADMIN_PASSWORD "$ADMIN_PWD"
  GENERATED_ADMIN_PWD=1
  ok "generated bootstrap admin password (24 chars)"
else
  GENERATED_ADMIN_PWD=0
  ok "SUBTERRADB_ADMIN_PASSWORD already set — keeping existing value"
fi

# Detect public host (for the connection URLs shown in the GUI). The user
# can override this in .env to set a domain name or LAN IP.
PUBLIC_HOST="$(read_env SUBTERRADB_PUBLIC_DB_HOST)"
if [[ -z "$PUBLIC_HOST" ]]; then
  # Best-effort detection: first non-loopback IPv4 from `hostname -I` if it
  # exists (Linux), otherwise localhost.
  if command -v hostname &> /dev/null && hostname -I &> /dev/null; then
    DETECTED="$(hostname -I 2>/dev/null | awk '{print $1}')"
    PUBLIC_HOST="${DETECTED:-localhost}"
  else
    PUBLIC_HOST="localhost"
  fi
  set_env SUBTERRADB_PUBLIC_DB_HOST "$PUBLIC_HOST"
  set_env KONG_PROXY_URL "http://${PUBLIC_HOST}:58000"
  ok "detected public host: ${PUBLIC_HOST}"
else
  ok "SUBTERRADB_PUBLIC_DB_HOST already set: ${PUBLIC_HOST}"
fi

# Generate a strong POSTGRES_PASSWORD if missing or still set to the
# well-known default. Important: this only takes effect on FRESH installs
# (when the postgres data volume is being initialized for the first time).
# Postgres reads POSTGRES_PASSWORD only on first init; after that the
# password lives inside pg_authid and the env var is ignored. If we detect
# an existing volume + a default password, we warn the operator instead of
# silently doing nothing.
PG_PASS_CURRENT="$(read_env POSTGRES_PASSWORD)"
PG_VOLUME_EXISTS="no"
if docker volume inspect subterradb_postgres_data &> /dev/null; then
  PG_VOLUME_EXISTS="yes"
fi

if [[ -z "$PG_PASS_CURRENT" ]] || [[ "$PG_PASS_CURRENT" == "postgres" ]]; then
  if [[ "$PG_VOLUME_EXISTS" == "no" ]]; then
    NEW_PG_PASS="$(openssl rand -base64 24 | tr -d '\n=' | tr '/+' '_-' | head -c 32)"
    set_env POSTGRES_PASSWORD "$NEW_PG_PASS"
    ok "generated strong POSTGRES_PASSWORD (32 chars)"
  else
    set_env POSTGRES_PASSWORD "postgres"
    warn "POSTGRES_PASSWORD is still the well-known default 'postgres'"
    warn "and the postgres data volume already exists, so I cannot rotate"
    warn "it automatically without risking your data. To fix, run:"
    warn ""
    warn "  NEW_PASS=\"\$(openssl rand -base64 24 | tr -d '\\n=' | tr '/+' '_-' | head -c 32)\""
    warn "  docker exec subterradb-postgres psql -U postgres -c \"ALTER USER postgres PASSWORD '\$NEW_PASS';\""
    warn "  sed -i \"s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\$NEW_PASS|\" .env"
    warn "  docker compose --env-file .env up -d --force-recreate subterradb-gui"
    warn ""
    warn "This is CRITICAL if your VM is exposed to the public internet."
  fi
else
  ok "POSTGRES_PASSWORD already set — keeping existing value"
fi

# Detect the host's `docker` group GID. The GUI container runs as a non-root
# user that needs to be in this group to read /var/run/docker.sock — without
# it, dockerode calls fail with EACCES and project provisioning errors out.
# We pass the GID to docker compose via .env → group_add in the compose file.
DOCKER_GID="$(getent group docker 2>/dev/null | cut -d: -f3 || true)"
if [[ -n "$DOCKER_GID" ]]; then
  set_env DOCKER_GID "$DOCKER_GID"
  ok "detected host docker group GID: ${DOCKER_GID}"
else
  warn "could not detect host docker group — using fallback GID 999"
  warn "if project creation fails with EACCES on /var/run/docker.sock,"
  warn "find the GID with \`getent group docker\` and set DOCKER_GID in .env"
  set_env DOCKER_GID "999"
fi

# ----- 3. Build + start the stack --------------------------------------------
hdr "Building and starting the stack"
info "This pulls postgres, kong, supabase images and builds the GUI."
info "First run takes ~3-5 minutes; subsequent runs are <30 seconds."
echo

# Capture postgres's container ID (if any) before bringing the stack up so we
# can detect whether `docker compose up` recreated it. Recreating postgres is
# the most common cause of stale connection pools in the per-project containers
# (postgrest / gotrue / storage / realtime), since those don't live in the
# compose file and aren't touched by `compose up`. We use this to decide
# whether to restart them after.
PG_CONTAINER_ID_BEFORE="$(docker inspect -f '{{.Id}}' subterradb-postgres 2>/dev/null || true)"

docker compose --env-file "$ENV_FILE" up -d --build

PG_CONTAINER_ID_AFTER="$(docker inspect -f '{{.Id}}' subterradb-postgres 2>/dev/null || true)"

# If postgres was recreated (different container ID before vs after, AND
# there was a postgres before), every per-project container that was already
# running is now holding TCP sockets to a container that no longer exists.
# Their connection pools will return "broken pipe" on the next query. Restart
# them so they reconnect to the new postgres container cleanly.
if [[ -n "$PG_CONTAINER_ID_BEFORE" ]] && [[ "$PG_CONTAINER_ID_BEFORE" != "$PG_CONTAINER_ID_AFTER" ]]; then
  echo
  warn "postgres was recreated by docker compose"
  warn "→ restarting per-project containers so their connection pools refresh"
  PROJECT_CONTAINERS="$(docker ps --filter label=subterradb.project_slug --format '{{.Names}}')"
  if [[ -n "$PROJECT_CONTAINERS" ]]; then
    # `docker restart` accepts multiple names; xargs -r is a no-op if empty.
    echo "$PROJECT_CONTAINERS" | xargs -r docker restart > /dev/null
    COUNT=$(echo "$PROJECT_CONTAINERS" | wc -l | tr -d '[:space:]')
    ok "restarted ${COUNT} per-project container(s)"
  else
    info "no per-project containers were running — nothing to restart"
  fi
fi

# ----- 4. Wait until everything is healthy -----------------------------------
hdr "Waiting for services to become healthy"

wait_for_healthy() {
  local container="$1"
  local timeout=180
  local elapsed=0
  while [[ $elapsed -lt $timeout ]]; do
    local status
    status="$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo 'missing')"
    if [[ "$status" == "healthy" ]]; then
      ok "${container}: healthy"
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
    printf "."
  done
  echo
  err "${container} did not become healthy in ${timeout}s"
  echo "  Check the logs:  docker logs ${container}"
  return 1
}

wait_for_healthy subterradb-postgres
wait_for_healthy subterradb-kong
wait_for_healthy subterradb-gui

# ----- 5. Success banner -----------------------------------------------------
PUBLIC_HOST="$(read_env SUBTERRADB_PUBLIC_DB_HOST)"
ADMIN_EMAIL="$(read_env SUBTERRADB_ADMIN_EMAIL)"
[[ -z "$ADMIN_EMAIL" ]] && ADMIN_EMAIL="admin@subterra.local"
ADMIN_PWD="$(read_env SUBTERRADB_ADMIN_PASSWORD)"

# ----- 5. Post-install smoke test --------------------------------------------
# Quick sanity check before declaring victory. We hit each user-facing
# endpoint and abort with a clear error if anything is unhealthy. This
# catches the class of bugs where every container is "healthy" by docker's
# metric but the actual HTTP surface is broken (bad migration, missing env
# var, dead connection pool, etc.).
hdr "Smoke test"

smoke_check() {
  local label="$1"
  local url="$2"
  local expected="$3"
  local got
  got="$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$url" 2>/dev/null || echo '000')"
  if [[ "$got" == "$expected" ]]; then
    ok "${label}: HTTP ${got}"
    return 0
  else
    err "${label}: HTTP ${got} (expected ${expected})"
    return 1
  fi
}

SMOKE_FAILED=0
smoke_check "GUI health" "http://localhost:3000/api/health" "200" || SMOKE_FAILED=1
smoke_check "GUI login page" "http://localhost:3000/en/login" "200" || SMOKE_FAILED=1
smoke_check "Kong proxy root" "http://localhost:58000/" "404" || SMOKE_FAILED=1

# If there are existing projects, hit one of them through Kong end-to-end
# to validate the full request path (Kong → per-project postgrest → postgres).
EXISTING_SLUG="$(docker exec subterradb-postgres psql -U postgres -d subterradb_system -t -A -c \
  "SELECT slug FROM projects WHERE status='running' LIMIT 1" 2>/dev/null | tr -d '[:space:]' || true)"
if [[ -n "$EXISTING_SLUG" ]]; then
  EXISTING_KEY="$(docker exec subterradb-postgres psql -U postgres -d subterradb_system -t -A -c \
    "SELECT service_key FROM projects WHERE slug='$EXISTING_SLUG'" 2>/dev/null | tr -d '[:space:]')"
  GOT="$(curl -s -o /dev/null -w '%{http_code}' -m 5 \
    -H "apikey: $EXISTING_KEY" -H "Authorization: Bearer $EXISTING_KEY" \
    "http://localhost:58000/${EXISTING_SLUG}/rest/v1/" 2>/dev/null || echo '000')"
  if [[ "$GOT" == "200" ]]; then
    ok "sample project /${EXISTING_SLUG}/rest/v1/: HTTP 200"
  else
    err "sample project /${EXISTING_SLUG}/rest/v1/: HTTP ${GOT} (expected 200)"
    SMOKE_FAILED=1
  fi
fi

if [[ "$SMOKE_FAILED" -ne 0 ]]; then
  echo
  err "One or more smoke tests failed. The stack may be partially up."
  err "Check logs:  docker compose logs --tail 100"
  exit 1
fi

# ----- 6. Success banner -----------------------------------------------------
echo
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo -e "${GREEN}${BOLD}  🎉  SubterraDB v${SUBTERRADB_VERSION} is up${RESET}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
echo
echo -e "  ${BOLD}GUI:${RESET}            http://${PUBLIC_HOST}:3000"
echo -e "  ${BOLD}Kong proxy:${RESET}     http://${PUBLIC_HOST}:58000"
echo -e "  ${BOLD}Kong admin API:${RESET} http://127.0.0.1:58001 (localhost only)"
echo
echo -e "  ${BOLD}Admin email:${RESET}    ${ADMIN_EMAIL}"
if [[ "$GENERATED_ADMIN_PWD" -eq 1 ]]; then
  echo -e "  ${BOLD}Admin password:${RESET} ${YELLOW}${ADMIN_PWD}${RESET}  ${BLUE}← write this down, also stored in .env${RESET}"
else
  echo -e "  ${BOLD}Admin password:${RESET} (preserved from existing .env)"
fi
echo
echo -e "  ${BOLD}Manage:${RESET}"
echo -e "    ${BLUE}docker compose logs -f subterradb-gui${RESET}   # tail GUI logs"
echo -e "    ${BLUE}docker compose down${RESET}                      # stop the stack"
echo -e "    ${BLUE}docker compose up -d${RESET}                     # start it again"
echo
echo -e "  ${BOLD}Upgrade later:${RESET}"
echo -e "    ${BLUE}git pull && ./bin/install.sh${RESET}"
echo
