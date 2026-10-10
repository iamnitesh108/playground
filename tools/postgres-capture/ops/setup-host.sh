# Server: opslab (10.0.1.10, Ubuntu 24.04 + PGDG). Client: another machine at 10.0.1.20.
srv() { podman exec -i opslab su postgres -c "$*" 2>&1; }
cli() { echo "client\$ psql \"$1\" -c \"$2\""; podman run --rm --network opsnet --ip 10.0.1.20 -e PGPASSWORD="${PW:-}" -e PGCONNECT_TIMEOUT=3 docker.io/library/postgres:18 psql "$1" -c "$2" 2>&1; echo; }
step() { echo "### $1"; }
H=/etc/postgresql/18/main/pg_hba.conf
step listen-refused
cli "host=10.0.1.10 dbname=shop user=app_rw" "SELECT 1"
step alter-system
srv "psql -c \"ALTER SYSTEM SET listen_addresses = '*'\" -c \"ALTER SYSTEM SET shared_buffers = '512MB'\" -c 'SELECT pg_reload_conf()'"
sleep 1
srv "psql -c \"SELECT name, setting, unit, pending_restart FROM pg_settings WHERE name IN ('listen_addresses','shared_buffers')\""
srv "cat /var/lib/postgresql/18/main/postgresql.auto.conf"
podman exec opslab pg_ctlcluster 18 main restart
srv "psql -c \"SELECT name, setting, unit, pending_restart FROM pg_settings WHERE name IN ('listen_addresses','shared_buffers')\" -c 'SHOW shared_buffers'"
step roles
srv "psql -v ON_ERROR_STOP=1" <<'SQL'
CREATE ROLE app_owner NOLOGIN;
CREATE ROLE app_rw LOGIN PASSWORD 'app-secret';
CREATE DATABASE shop OWNER app_owner;
\c shop
CREATE SCHEMA app AUTHORIZATION app_owner;
GRANT USAGE ON SCHEMA app TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;
ALTER DEFAULT PRIVILEGES FOR ROLE app_owner IN SCHEMA app GRANT USAGE ON SEQUENCES TO app_rw;
SET ROLE app_owner;
CREATE TABLE app.orders (id bigserial PRIMARY KEY, amount numeric(12,2) NOT NULL);
RESET ROLE;
\dp app.*
SQL
step hba-reject
cli "host=10.0.1.10 dbname=shop user=app_rw" "SELECT 1"
step hba-add
podman exec opslab bash -c "echo 'host    shop            app_rw          10.0.1.0/24             scram-sha-256' >> $H"
srv "psql -Atc 'SELECT pg_reload_conf()'"
sleep 1
srv "psql -c 'SELECT line_number, type, database, user_name, address, netmask, auth_method, error FROM pg_hba_file_rules ORDER BY line_number'"
step app-ok
PW=app-secret cli "host=10.0.1.10 dbname=shop user=app_rw" "INSERT INTO app.orders (amount) VALUES (25.00) RETURNING id, (SELECT inet_client_addr()) AS client"
step app-denied
PW=app-secret cli "host=10.0.1.10 dbname=shop user=app_rw" "DROP TABLE app.orders"
PW=app-secret cli "host=10.0.1.10 dbname=shop user=app_rw" "CREATE TABLE app.audit (id int)"
PW=app-secret cli "host=10.0.1.10 dbname=postgres user=app_rw" "SELECT 1"
PW=wrong cli "host=10.0.1.10 dbname=shop user=app_rw" "SELECT 1"
step log
podman exec opslab tail -n 8 /var/log/postgresql/postgresql-18-main.log
