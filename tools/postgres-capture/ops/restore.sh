step() { echo; echo "### $1"; }
sh() { echo "\$ $*"; su postgres -c "$*" 2>&1; }
q() { su postgres -c "psql -d shop -Atc \"$1\"" 2>&1; }
D=/var/lib/postgresql/18/main
BIN=/usr/lib/postgresql/18/bin
GOOD="$1"
step verify
sh "$BIN/pg_verifybackup /backup/base/full"
sh "$BIN/pg_verifybackup /backup/base/incr1"
step restore
sh "$BIN/pg_combinebackup /backup/base/full /backup/base/incr1 -o $D"
cat > /etc/postgresql/18/main/conf.d/recovery.conf <<R
restore_command = 'cp /backup/wal/%f %p'
recovery_target_time = '$GOOD'
recovery_target_action = 'promote'
R
echo "\$ cat /etc/postgresql/18/main/conf.d/recovery.conf"; cat /etc/postgresql/18/main/conf.d/recovery.conf
sh "touch $D/recovery.signal"
LOGLINES=$(wc -l < /var/log/postgresql/postgresql-18-main.log)
pg_ctlcluster 18 main start
sleep 4
step recovery-log
tail -n +$((LOGLINES+1)) /var/log/postgresql/postgresql-18-main.log
step result
q "SELECT id, amount FROM app.orders ORDER BY id"
q "SELECT pg_is_in_recovery(), (SELECT timeline_id FROM pg_control_checkpoint())"
sh "ls /backup/wal"
sh "cat /backup/wal/00000002.history"
sh "ls $D | grep signal"
rm /etc/postgresql/18/main/conf.d/recovery.conf
