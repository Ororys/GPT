#!/usr/bin/env bash
# Grappe synthétique neuve, utilisateur courant non root. Aucun répertoire n'est effacé.
# Usage: PG_BINDIR=/chemin/bin scripts/local-pg.sh /chemin/nouveau 55432
set -euo pipefail
D=${1:?répertoire neuf requis}; P=${2:-55432}
B=${PG_BINDIR:-/usr/lib/postgresql/16/bin}
[[ $D =~ ^/[A-Za-z0-9_./-]+$ ]] || { echo 'Chemin absolu simple requis (sans espaces ni métacaractères)' >&2; exit 1; }
[[ $P =~ ^[0-9]+$ ]] && (( P > 1023 && P < 65536 )) || { echo 'Port invalide' >&2; exit 1; }
[[ $(id -u) != 0 ]] || { echo 'Exécuter avec un utilisateur non root' >&2; exit 1; }
[[ ! -e $D && ! -L $D ]] || { echo 'Répertoire existant refusé' >&2; exit 1; }
mkdir -m 700 -- "$D"
PW=$(mktemp); chmod 600 "$PW"; trap 'rm -f -- "$PW"' EXIT
openssl rand -hex 24 > "$PW"
"$B/initdb" -D "$D" -U hc_admin --pwfile="$PW" --auth=scram-sha-256 -E UTF8 >/dev/null
# Identifiant local conservé dans un fichier privé ; ne pas versionner.
printf 'postgresql://hc_admin:%s@127.0.0.1:%s/postgres\n' "$(cat "$PW")" "$P" > "$D/admin-url"
chmod 600 "$D/admin-url"
"$B/pg_ctl" -D "$D" -o "-p $P -c listen_addresses=127.0.0.1 -c unix_socket_directories='$D'" -l "$D/log" -w start >/dev/null
echo "PostgreSQL prêt ; URL privée : $D/admin-url ; arrêt : $B/pg_ctl -D $D stop"
