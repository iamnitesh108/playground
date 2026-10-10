# Runs inside the lab server: PgBouncer in front of the local cluster, three pools.
set -e
SECRET=$(su postgres -c "psql -Atc \"SELECT rolpassword FROM pg_authid WHERE rolname = 'app_rw'\"")
cat > /etc/pgbouncer/userlist.txt <<U
"app_rw" "$SECRET"
"pooladmin" "admin-secret"
U
cat > /etc/pgbouncer/pgbouncer.ini <<'INI'
[databases]
shop         = host=127.0.0.1 port=5432 dbname=shop
shop_single  = host=127.0.0.1 port=5432 dbname=shop pool_size=1
shop_session = host=127.0.0.1 port=5432 dbname=shop pool_mode=session

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt
admin_users = pooladmin
pool_mode = transaction
default_pool_size = 2
max_client_conn = 100
logfile = /var/log/postgresql/pgbouncer.log
pidfile = /var/run/postgresql/pgbouncer.pid
INI
chown postgres /etc/pgbouncer/userlist.txt /etc/pgbouncer/pgbouncer.ini
su postgres -c "pgbouncer -d /etc/pgbouncer/pgbouncer.ini"
