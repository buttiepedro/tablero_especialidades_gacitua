# Tablero de especialidades — arquitectura separada

Este proyecto quedó dividido en dos módulos independientes:

- `backend/` → API Flask + Socket.IO que gestiona órdenes y emite eventos.
- `frontend/` → Single Page App estática (HTML/JS) que consume la API y muestra el tablero.

## Backend (`backend/`)

El backend ejecuta Flask + Flask-SocketIO sobre Gunicorn + Eventlet. La carpeta contiene:

- `app.py`: entrypoint que crea la app mediante `create_app()` y levanta `socketio` en 0.0.0.0.
- `service/`: módulos separados para extensiones (`extensions.py`), modelos (`models.py`), rutas (`routes.py`) y sincronización del esquema (`schema.py`).
- `db/schema.sql`: DDL usada por `ensure_schema()` para recrear la tabla cuando cambia.
- `requirements.txt` y `Dockerfile` específicos.

Variables de entorno relevantes:

| Variable | Uso |
| --- | --- |
| `DATABASE_URL` | Cadena SQLAlchemy hacia Postgres (por ejemplo `postgresql://user:password@host:5432/db`). |
| `FLASK_ENV` | Ambiente (solo impacta el flag `debug` en el entrypoint). |
| `SECRET_KEY` | Clave secreta para JWT y seguridad del app. |

Para construir y correr la imagen backend:

```bash
cd backend
docker build -t tablero-backend .
docker run -p 5000:5000 \
  -e DATABASE_URL=... \
  -e SECRET_KEY=... \
  tablero-backend
```

El contenedor arranca con Gunicorn sobre `backend.app:app`, escucha en `0.0.0.0:5000` y usa Eventlet para Socket.IO.

## Frontend (`frontend/`)

El frontend es una SPA liviana que exhibe la tabla de especialidades. Archivos:

- `index.html`, `app.js`, `styles.css` y `config.js` (este último se reescribe al arranque con la URL real de la API).
- `docker-entrypoint.sh` genera `config.js` a partir de la variable `API_URL` y luego arranca Nginx.
- `Dockerfile` copia los assets y expone el puerto 80.

Variables de entorno:

| Variable | Uso |
| --- | --- |
| `API_URL` | URL pública donde corre el backend (ej. `https://tablero-backend...`). |

Para crear la imagen del frontend:

```bash
cd frontend
docker build -t tablero-frontend .
docker run -p 80:80 -e API_URL=https://tablero-backend... tablero-frontend
```

## Flujo típico de despliegue

1. Rebuild del backend (`docker build backend/ ...`) con la nueva imagen y push si necesitás un registry.
2. Rebuild del frontend (`docker build frontend/ ...`), con `API_URL` apuntando al dominio final del backend.
3. Configurar EasyPanel o el orquestador para levantar ambas imágenes y exponer sus puertos.

Si querés que te arme los comandos exactos para tu entorno EasyPanel (incluyendo variables), avisame y te los dejo listos.
