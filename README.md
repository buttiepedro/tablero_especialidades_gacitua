# Tablero de especialidades (Gacitúa)

Una pequeña aplicación para gestionar el listado de especialidades médicas. La lista de `Especialidad` se actualiza automáticamente mediante la API de sincronización, mientras que los campos `Activo` y `Descripción` se mantienen manualmente desde la tabla que se muestra al iniciar sesión.

## Stack
- Flask + Flask-SQLAlchemy (SQLite por defecto, se puede apuntar a cualquier `DATABASE_URL`).
- JWT simple para proteger todos los endpoints.
- UI mínima en HTML/CSS/JS que requiere login y muestra la tabla con las tres columnas solicitadas.
- Dockerfile listo para desplegar en EasyPanel o cualquier servicio que ejecute contenedores.

## Variables de entorno (copiá `.env.example` a `.env`)

| Variable | Descripción |
| --- | --- |
| `ADMIN_USER` | Usuario que podrá loguearse en la interfaz y consumir la API. |
| `ADMIN_PASSWORD` | Contraseña del administrador. |
| `SECRET_KEY` | Clave secreta para firmar los tokens JWT. |
| `DATABASE_URL` | Cadena de conexión SQLAlchemy (por defecto `sqlite:///data/especialidades.db`). |

## Endpoints

| Ruta | Método | Descripción |
| --- | --- | --- |
| `POST /login` | JSON `{ username, password }` | Devuelve un token JWT válido por 12h si las credenciales de `.env` coinciden. |
| `GET /especialidades` | — | Lista todas las especialidades con sus columnas (`activo`, `descripcion`). Requiere `Authorization: Bearer <token>`. |
| `PUT /especialidades/<id>` | JSON `{ activo?, descripcion? }` | Guarda los cambios en los campos manuales. |
| `POST /sync/especialidades` | JSON `{ "especialidades": ["Cardiología", ...] }` | Reemplaza la lista de especialidades por la enviada; las nuevas se crean y las que no vienen se eliminan. |
| `GET /health` | — | Salud básica del servicio (útil para monitoreo). |

## UI

1. Entrá a la raíz (`/`), completá usuario/contraseña y presioná "Entrar".
2. El tablero mostrará las especialidades sincronizadas y te dejará marcar `Activo` y escribir una `Descripción` para cada una.
3. Guardá cada fila presionando el botón "Guardar" correspondiente.

## Sincronización diaria

Tu proceso diario debe llamar a `POST /sync/especialidades` con el array completo de especialidades actuales. Ejemplo de cuerpo:

```json
{ "especialidades": ["Cardiología", "Pediatría", "Medicina Interna"] }
```

Este endpoint reemplaza las filas existentes, así que si querés conservar una descripción o estado para una especialidad que ya no existe en la lista, guardala manualmente antes de eliminarla.

## Docker / deploy en EasyPanel

1. Copiá `.env.example` a `.env` y completá las variables.
2. Construí la imagen:
   ```bash
docker build -t tablero-especialidades .
```
3. Ejecutá el contenedor exponiendo el puerto 5000 y pasando las variables:
   ```bash
docker run -d -p 5000:5000 \
  -e ADMIN_USER=pedro \
  -e ADMIN_PASSWORD=secreto \
  -e SECRET_KEY=otra-clave \
  tablero-especialidades
```
4. EasyPanel puede consumir esta misma imagen apuntando al `Dockerfile` y exponiendo el puerto 5000.

## Primer push (cuando lo tengas todo listo)

```bash
cd tablero_especialidades_gacitua
git add .
git commit -m "Inicial: tablero de especialidades"
git push origin main
```

Acordate de generar un token y usarlo como contraseña si lo hacés desde la línea de comandos.
