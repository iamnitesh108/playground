step() { echo; echo "### $1"; }
sh() { echo "\$ $*"; su postgres -c "$*" 2>&1; }
q() { su postgres -c "psql -d shop -Atc \"$1\"" 2>&1; }
D=/var/lib/postgresql/18/main
mkdir -p /backup/wal /backup/base && chown -R postgres /backup
step archive-config
su postgres -c "psql -c \"ALTER SYSTEM SET archive_mode = 'on'\" -c \"ALTER SYSTEM SET archive_command = 'test ! -f /backup/wal/%f && cp %p /backup/wal/%f'\" -c \"ALTER SYSTEM SET summarize_wal = 'on'\"" 2>&1
pg_ctlcluster 18 main restart
q "SELECT name, setting FROM pg_settings WHERE name IN ('archive_mode','archive_command','summarize_wal','wal_level') ORDER BY 1"
step dump
sh "pg_dump -Fc -d shop -f /backup/shop.dump"
sh "pg_restore --list /backup/shop.dump | grep -v '^;' | grep -v '^\$'"
sh "pg_dumpall --globals-only | grep -E '^(CREATE|ALTER) ROLE'"
sh "createdb shop_copy && pg_restore -d shop_copy /backup/shop.dump && psql -d shop_copy -Atc 'SELECT count(*) FROM app.orders'"
step full
sh "pg_basebackup -D /backup/base/full -c fast -P"
sh "cat /backup/base/full/backup_label"
sh "pg_verifybackup /backup/base/full"
step after-full
q "INSERT INTO app.orders (amount) VALUES (10), (20) RETURNING id, amount"
step incremental
sh "pg_basebackup -D /backup/base/incr1 -c fast --incremental=/backup/base/full/backup_manifest"
sh "du -sh /backup/base/full /backup/base/incr1"
step good
q "INSERT INTO app.orders (amount) VALUES (30) RETURNING id, amount"
sleep 1
GOOD=$(q "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00'")
echo "good point: $GOOD"
q "SELECT id, amount FROM app.orders ORDER BY id"
sleep 2
step accident
q "SELECT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') || '+00'"
sh "psql -d shop -c 'DROP TABLE app.orders'"
q "SELECT pg_walfile_name(pg_switch_wal())"
sleep 2
q "SELECT archived_count, last_archived_wal, failed_count FROM pg_stat_archiver"
sh "ls /backup/wal"
step restore
pg_ctlcluster 18 main stop
mv $D /var/lib/postgresql/18/main.broken
sh "pg_combinebackup /backup/base/full /backup/base/incr1 -o $D"
cat > /etc/postgresql/18/main/conf.d/recovery.conf <<R
restore_command = 'cp /backup/wal/%f %p'
recovery_target_time = '$GOOD'
recovery_target_action = 'promote'
R
echo "\$ cat /etc/postgresql/18/main/conf.d/recovery.conf"; cat /etc/postgresql/18/main/conf.d/recovery.conf
su postgres -c "touch $D/recovery.signal"
LOGLINES=$(wc -l < /var/log/postgresql/postgresql-18-main.log)
pg_ctlcluster 18 main start
sleep 3
step recovery-log
tail -n +$((LOGLINES+1)) /var/log/postgresql/postgresql-18-main.log
step result
q "SELECT id, amount FROM app.orders ORDER BY id"
q "SELECT pg_is_in_recovery(), timeline_id FROM pg_control_checkpoint()"
sh "ls /backup/wal"
sh "cat /backup/wal/00000002.history"
sh "ls $D | grep -c signal"
rm /etc/postgresql/18/main/conf.d/recovery.conf
