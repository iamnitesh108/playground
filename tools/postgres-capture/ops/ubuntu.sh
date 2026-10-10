set -e
export DEBIAN_FRONTEND=noninteractive
run() { echo "\$ $*"; "$@" 2>&1; echo; }
apt-get update -qq >/dev/null
apt-get install -y -qq postgresql-common ca-certificates >/dev/null
/usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y >/dev/null 2>&1
apt-get install -y -qq postgresql-18 pgbouncer >/dev/null 2>&1
{
run pg_lsclusters
run pg_ctlcluster 18 main start
run pg_lsclusters
run ls /etc/postgresql/18/main
run ls /var/lib/postgresql/18/main
run su postgres -c "psql -Atc \"SELECT name, setting FROM pg_settings WHERE name IN ('config_file','data_directory','hba_file','listen_addresses','port','max_connections','shared_buffers','password_encryption','unix_socket_directories','wal_level','archive_mode') ORDER BY name\""
run grep -vE '^\s*(#|$)' /etc/postgresql/18/main/pg_hba.conf
run ls /etc/postgresql/18/main/conf.d
run ls /var/log/postgresql
run cat /etc/postgresql-common/createcluster.conf
run dpkg -l postgresql-18 pgbouncer
} > /out/ubuntu.txt
