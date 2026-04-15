# Tablero de especialidades — API + SPA separadas

Este proyecto tiene dos servicios independientes, uno para la API (`backend/`) y otro para el frontend (`frontend/`). La aplicación permite loguearse, sincronizar las especialidades desde un workflow externo, marcar cada ítem como preparado y dejar una ficha general de la clínica (descripción, ubicación y página web).

## Arquitectura

```
frontend/   → SPA estática (Nginx) que consume la API REST (login.html, general.html y especialidades.html)
backend/    → API Flask + Socket.IO (Gunicorn + Eventlet)
db/         → Definición del esquema SQL usado por backend/schema.py
```

El frontend y el backend pueden desplegarse como contenedores separados y comunicarse mediante la variable `API_URL`.

---

## Backend (`backend/`)

### Características

- Autenticación sencilla con `ADMIN_USER`/`ADMIN_PASSWORD` definidos vía entorno.
- Endpoints protegidos con JWT:
  - `POST /login` → devuelve token.
  - `GET /especialidades`, `PUT /especialidades/<id>` → listan y actualizan ítems.
- `POST /sync/especialidades` → reemplaza la lista de especialidades a partir de un array.
- `GET /clinic` y `PUT /clinic` → leen/actualizan la ficha general (descripción, dirección, URLs).
- `GET /faqs`, `POST /faqs`, `DELETE /faqs/<id>` → CRUD de preguntas frecuentes.
- `GET /health` → ruta de salud para monitorizar.
- Socket.IO emite eventos `update` cuando se crea o se marca un ítem (los clientes pueden suscribirse a `socket.io` si lo desean).
- `schema.py` calcula un hash del archivo SQL (`backend/db/schema.sql`) y ejecuta los DDL cuando cambia.

### Esquema (`backend/db/schema.sql`)

Incluye tablas `order`, `item` y `clinic_info`. Cada vez que el script detecta una nueva versión del SQL borra y recrea dichas tablas y guarda el hash en `schema_meta`.

### Variables de entorno (copia `backend/.env.example`)

| Variable | Descripción |
| --- | --- |
| `DATABASE_URL` | Cadena SQLAlchemy a Postgres (ej. `postgresql://user:pass@host:5432/db`). |
| `ADMIN_USER` / `ADMIN_PASSWORD` | Credenciales para loguearse. |
| `SECRET_KEY` | Clave secreta para firmar tokens. |
| `FLASK_ENV` | Controla si el entrypoint corre en modo debug (solo afecta la bandera `debug`). |

### Construcción y ejecución

```bash
cd backend
docker build -t tablero-backend .
docker run -d -p 5000:5000 \
  -e DATABASE_URL=... \
  -e ADMIN_USER=admin \
  -e ADMIN_PASSWORD=admin \
  -e SECRET_KEY=secreto \
  tablero-backend
```

En EasyPanel podés usar esa imagen y exponer el puerto 5000. La imagen ya crea `/nonexistent/.gunicorn` para que el control socket funcione sin errores.

---

## Frontend (`frontend/`)

### Características

- Login con las mismas credenciales del backend.
- Dos pestañas:
  - **General:** completás la descripción de la clínica, dirección, URL de ubicación y página web. El `PUT /clinic` guarda esos datos.
  - **Especialidades:** muestra la tabla de especialidades, permite marcar `Activo` y editar la descripción para cada una, y llama a los endpoints REST habituales.
- **FAQs:** podés agregar y eliminar pares de pregunta/respuesta que se almacenan en la tabla `faqs`.
- `config.js` se genera al inicio con `API_URL` para que todas las llamadas HTTP apunten al backend correcto.

### Variables y entorno

| Variable | Descripción |
| --- | --- |
| `API_URL` | URL pública del backend (ej. `https://tablero-backend...`). |

### Construcción y ejecución

```bash
cd frontend
docker build -t tablero-frontend .
docker run -d -p 80:80 -e API_URL=https://tablero-backend... tablero-frontend
```

La imagen copia `index.html`, `app.js`, `styles.css` y usa un entrypoint que reescribe `config.js` según `API_URL` antes de correr Nginx.

---

## Despliegue en EasyPanel

1. Subí la rama a GitHub (`git push origin main`).
2. En EasyPanel configurá dos apps:
   - `_tablero-backend`: apunta al contexto `backend/`, define las variables `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SECRET_KEY` y expone el puerto 5000.
   - `_tablero-frontend`: apunta al contexto `frontend/`, define `API_URL` apuntando al backend y expone el puerto 80.
3. Ambos servicios se conectan vía `API_URL` y el frontend obtiene automáticamente el dominio correcto gracias al `config.js` reescrito por el entrypoint.

Si querés te paso también la lista completa de comandos para construir/pushear ambos contenedores y reiniciar los servicios en EasyPanel. ¿Querés que te los escriba? Te los mando en el próximo mensaje. Meanwhile, si vas a subir los cambios ahora, recordá usar `git add`, `git commit` y `git push` como te dije antes. Por si te olvidaste, te los repito:

```bash
cd tablero_especialidades_gacitua
git add -A
git commit -m "Split backend/frontend and add clinic info screen"
git push origin main
```

Listo, avísame si querés que te prepare los comandos `docker build`/`docker push` con tus variables específicas.
