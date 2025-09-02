# rpg-ksiegi server

Prosty backend Express do zarządzania katalogiem książek.

## Szybki start

1. Skopiuj `.env.example` jako `.env` i uzupełnij dane:

```
cp server/.env.example server/.env
# edytuj i zmień JWT_SECRET, hasło itp.
```

2. Zainstaluj zależności i uruchom:

```
cd server
npm install
npm run start
```

Serwer nasłuchuje domyślnie na http://localhost:4000.

## API

- POST /api/auth/login { username, password } -> { token }
- POST /api/auth/logout (Bearer) -> { ok }
- GET /api/books -> lista książek (publicznie)
- GET /api/admin/books (Bearer) -> lista
- POST /api/admin/books (Bearer) -> dodanie
- PUT /api/admin/books/:slug (Bearer) -> nadpisanie
- DELETE /api/admin/books/:slug (Bearer) -> usunięcie

Dane zapisują się w pliku wskazanym przez DATA_FILE (domyślnie `server/data/books.json`).
