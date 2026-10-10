# The postgres:18 image with the pre-18 volume path, and with the recommended one.
for v in pgold pgnew; do podman rm -f $v >/dev/null 2>&1; podman volume rm -f $v >/dev/null 2>&1; done
podman run -d --name pgold -e POSTGRES_PASSWORD=x -v pgold:/var/lib/postgresql/data docker.io/library/postgres:18 >/dev/null
podman run -d --name pgnew -e POSTGRES_PASSWORD=x -v pgnew:/var/lib/postgresql docker.io/library/postgres:18 >/dev/null
sleep 6
{ echo '### old-mount'; podman logs pgold 2>&1 | sed -n '1,13p'
  echo '### new-mount'; podman exec pgnew sh -c 'echo "\$ ls /var/lib/postgresql"; ls /var/lib/postgresql; echo "\$ psql -U postgres -Atc \"SHOW data_directory\""; psql -U postgres -Atc "SHOW data_directory"'
} > "$(dirname "$0")/docker.txt"
podman rm -f pgold pgnew >/dev/null; podman volume rm -f pgold pgnew >/dev/null
