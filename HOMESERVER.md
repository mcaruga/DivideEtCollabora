# Self-host su server di casa

Guida rapida per far girare DivideEtCollabora sul tuo server domestico con **Docker Compose** (app + PostgreSQL + backup opzionale).

## Requisiti

- Docker Engine ≥ 24 e `docker compose` ≥ v2 (Ubuntu/Debian: `curl -fsSL https://get.docker.com | sh`)
- ~1 GB RAM libera, ~2 GB disco per l'immagine + database iniziale
- Il repository clonato sul server

## 1. Setup iniziale

```bash
git clone https://github.com/mcaruga/divideetcollabora.git
cd divideetcollabora
cp .env.homeserver.example .env
```

Modifica `.env` con un editor e imposta almeno:

- `POSTGRES_PASSWORD` — password del database
- `JWT_SECRET` — segreto per firmare i token (genera con `openssl rand -hex 48`)
- `FRONTEND_URL` — URL dove sarà raggiungibile l'app (es. `http://192.168.1.10:3001` per LAN, oppure `https://divide.tuodominio.it` se esponi via Cloudflare)

## 2. Avvio

```bash
docker compose up -d --build
```

Al primo avvio Prisma crea automaticamente le tabelle nel database (`prisma db push`). L'app risponde su `http://<ip-server>:3001`.

Segui i log:

```bash
docker compose logs -f app
```

## 3. Primo amministratore

Registrati normalmente via UI (`http://<ip-server>:3001/register`), poi promuovi il tuo utente ad admin dal database:

```bash
docker compose exec db psql -U divideetcollabora -d divideetcollabora \
  -c "UPDATE \"User\" SET \"isAdmin\" = true WHERE email = 'tua@email.com';"
```

Ora il pannello `/admin` è accessibile con il tuo account.

## 4. Aggiornamenti

```bash
git pull
docker compose up -d --build
```

Prisma applica lo schema aggiornato all'avvio.

## 5. Backup automatico (opzionale)

Il file `docker-compose.yml` include un servizio `backup` che fa `pg_dump` ogni notte in `./backups/` e mantiene gli ultimi 14 giorni. Abilitalo con:

```bash
docker compose --profile backup up -d
```

Ripristino da dump:

```bash
docker compose exec -T db pg_restore -U divideetcollabora -d divideetcollabora --clean < backups/dec-YYYYMMDD-HHMMSS.dump
```

## 6. Esposizione pubblica (opzionale)

### Opzione A — Cloudflare Tunnel (consigliato)

Nessuna porta aperta sul router, HTTPS gratuito, IP dinamico OK.

1. Installa `cloudflared` sul server e collega il tunnel al tuo account Cloudflare
2. Aggiungi al tuo `cloudflared/config.yml`:
   ```yaml
   ingress:
     - hostname: divide.tuodominio.it
       service: http://localhost:3001
     - service: http_status:404
   ```
3. Aggiorna `FRONTEND_URL=https://divide.tuodominio.it` in `.env` e riavvia (`docker compose up -d`)

### Opzione B — Nginx + Let's Encrypt

Se hai già un IP pubblico e Nginx sul server:

```nginx
server {
    listen 443 ssl http2;
    server_name divide.tuodominio.it;

    ssl_certificate     /etc/letsencrypt/live/divide.tuodominio.it/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/divide.tuodominio.it/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 7. Comandi utili

```bash
docker compose ps                       # stato dei container
docker compose logs -f app              # log dell'app
docker compose restart app              # riavvio app soltanto
docker compose down                     # ferma tutto (dati preservati sui volumi)
docker compose down -v                  # ⚠️ ferma tutto E CANCELLA IL DATABASE

# Shell nel container app
docker compose exec app sh

# psql sul database
docker compose exec db psql -U divideetcollabora -d divideetcollabora

# Migrazione manuale di Prisma dopo cambi di schema
docker compose exec app npx --prefix backend prisma db push --schema=backend/prisma/schema.prisma
```

## 8. Risoluzione problemi

| Sintomo | Causa probabile | Fix |
|---|---|---|
| `app` in restart loop, log: `DATABASE_URL environment variable is not set` | `.env` mancante o var non caricate | Verifica che `.env` sia nella cartella dove lanci `docker compose` |
| `password authentication failed` | Password DB cambiata dopo primo avvio | Il volume `db-data` conserva la vecchia password; rimuovi con `docker compose down -v` (⚠️ perdi i dati) oppure aggiorna la password anche nel DB |
| Porta 3001 già in uso | Altro servizio in ascolto | Cambia `APP_PORT=3002` in `.env` |
| Upload ricevute non persistono | Volume `uploads` non montato | Assicurati di NON avere aggiunto `--rm` all'avvio; i volumi sopravvivono a `down` ma non a `down -v` |

## 9. Sicurezza minima

- Cambia `JWT_SECRET` e `POSTGRES_PASSWORD` prima del primo avvio
- Se esponi pubblicamente, usa HTTPS (Cloudflare Tunnel o Nginx + Let's Encrypt)
- I rate-limit sono già configurati nell'app (`express-rate-limit`)
- Abilita i backup automatici (`--profile backup`)
