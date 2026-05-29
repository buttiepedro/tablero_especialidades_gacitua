# Tablero de especialidades — API + SPA separadas

Dos servicios independientes: una API REST (`backend/`) y un frontend estático (`frontend/`). Permite loguearse, gestionar especialidades, editar la ficha de la clínica y administrar preguntas frecuentes.

## Arquitectura

```
frontend/   → SPA estática (Nginx) que consume la API REST
backend/    → API Flask (Gunicorn)
```

El frontend y el backend se despliegan como contenedores separados y se comunican mediante la variable `API_URL`.

---

## Backend (`backend/`)

### Variables de entorno

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `DATABASE_URL` | Cadena SQLAlchemy (SQLite o PostgreSQL). | `sqlite:///data/especialidades.db` |
| `ADMIN_USER` | Usuario para loguearse. | `admin` |
| `ADMIN_PASSWORD` | Contraseña para loguearse. | `changeme` |
| `SECRET_KEY` | Clave secreta para firmar tokens JWT. | `dev-secret` |

### Endpoints

| Método | Ruta | Descripción |
| --- | --- | --- |
| `POST` | `/login` | Autenticación. Devuelve token JWT (12 h). |
| `GET` | `/health` | Health check (sin auth). |
| `GET` | `/especialidades` | Lista especialidades. |
| `PUT` | `/especialidades/<id>` | Actualiza descripción de una especialidad. |
| `POST` | `/sync/especialidades` | Reemplaza la lista completa de especialidades. |
| `GET` / `PUT` | `/clinic` | Lee / actualiza la ficha de la clínica. |
| `GET` / `POST` | `/faqs` | Lista / crea preguntas frecuentes. |
| `DELETE` | `/faqs/<id>` | Elimina una pregunta frecuente. |

### Esquema de base de datos

Tablas: `specialidad`, `clinic_info`, `faqs`, `schema_meta`.  
La app calcula un hash SHA-256 de `db/schema.sql` y ejecuta los DDL automáticamente si el esquema cambió.

---

## Frontend (`frontend/`)

### Variables de entorno

| Variable | Descripción |
| --- | --- |
| `API_URL` | URL **pública** del backend, accesible desde el navegador (ej. `https://api.tudominio.com`). |

`API_URL` se inyecta en `config.js` al inicio del contenedor mediante `docker-entrypoint.sh`.

### Páginas

- **Login** (`index.html`)
- **General** (`general.html`) — edición de descripción, dirección y URLs de la clínica.
- **Especialidades** (`especialidades.html`) — tabla editable de especialidades.
- **FAQs** (`faqs.html`) — alta y baja de preguntas frecuentes.

---

## Ejecución con Docker Compose (local / Portainer)

### 1. Configurar variables de entorno

```bash
cp .env.example .env
# Editá .env con tus valores reales
```

> **Importante:** `API_URL` debe ser la URL **desde la que el navegador** alcanza al backend.  
> En local: `http://localhost:5000`.  
> En producción detrás de un proxy: la URL pública del servicio backend.

### 2. Construir y levantar

```bash
docker compose up -d --build
```

- Frontend disponible en `http://localhost:80`
- Backend disponible en `http://localhost:5000`

### 3. Usar en Portainer

1. En Portainer andá a **Stacks → Add stack**.
2. Pegá el contenido de `docker-compose.yml` o apuntá al repositorio.
3. En la sección **Environment variables** cargá los mismos valores que tenés en `.env`.
4. Hacé click en **Deploy the stack**.

---

## Despliegue en EasyPanel

1. Subí la rama a GitHub (`git push origin main`).
2. Configurá dos apps:
   - `tablero-backend`: contexto `backend/`, variables `DATABASE_URL`, `ADMIN_USER`, `ADMIN_PASSWORD`, `SECRET_KEY`, puerto 5000.
   - `tablero-frontend`: contexto `frontend/`, variable `API_URL` apuntando al backend, puerto 80.
