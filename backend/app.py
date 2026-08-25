import os
from datetime import datetime, timedelta
from functools import wraps
from hashlib import sha256
from pathlib import Path

import jwt
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import event, inspect, nullslast, text

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:////app/data/especialidades.db')
DB_SCHEMA = os.environ.get('DB_SCHEMA', '')

app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret')

if DATABASE_URL.startswith('postgresql'):
    _schema = DB_SCHEMA or 'public'
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'connect_args': {'options': f'-csearch_path={_schema}'}
    }

ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'changeme')

db = SQLAlchemy(app)

class Specialidad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), unique=True, nullable=False)
    descripcion = db.Column(db.Text, default='')
    atendido_por_bot = db.Column(db.Boolean, default=True, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


profesional_especialidad = db.Table(
    'profesional_especialidad',
    db.Column('profesional_id', db.Integer, db.ForeignKey('profesional.id', ondelete='CASCADE'), primary_key=True),
    db.Column('especialidad_id', db.Integer, db.ForeignKey('specialidad.id', ondelete='CASCADE'), primary_key=True),
)

practica_especialidad = db.Table(
    'practica_especialidad',
    db.Column('practica_id', db.Integer, db.ForeignKey('practica.id', ondelete='CASCADE'), primary_key=True),
    db.Column('especialidad_id', db.Integer, db.ForeignKey('specialidad.id', ondelete='CASCADE'), primary_key=True),
)


class Profesional(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    # id del profesional en Gacitua. Es la clave real: el bot lo necesita para pedir
    # turnos, y la importacion sincroniza contra el (no contra el nombre, que cambia).
    id_profesional = db.Column(db.Integer, unique=True, nullable=True)
    nombre = db.Column(db.String(255), nullable=False)
    sexo = db.Column(db.String(20), nullable=True)
    edad_min = db.Column(db.Integer, nullable=True)
    edad_max = db.Column(db.Integer, nullable=True)
    genero = db.Column(db.String(20), nullable=True)
    prioridad = db.Column(db.Integer, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    especialidades = db.relationship('Specialidad', secondary=profesional_especialidad, backref='profesionales')


class Practica(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)
    descripcion = db.Column(db.Text, default='')
    atendido_por_bot = db.Column(db.Boolean, default=True, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    especialidades = db.relationship('Specialidad', secondary=practica_especialidad, backref='practicas')


class SchemaMeta(db.Model):
    __tablename__ = 'schema_meta'
    id = db.Column(db.Integer, primary_key=True)
    schema_hash = db.Column(db.String, nullable=False)


class ClinicInfo(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    descripcion = db.Column(db.Text, default='')
    direccion = db.Column(db.String(255), default='')
    ubicacion_url = db.Column(db.String(255), default='')
    pagina_web = db.Column(db.String(255), default='')
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class FAQ(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    question = db.Column(db.String(1024), nullable=False)
    answer = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class TextoPredefinido(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), nullable=False)
    texto = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


def _schema_path() -> Path:
    return Path(__file__).resolve().parent / 'db' / 'schema.sql'


def _load_schema_script():
    path = _schema_path()
    raw = path.read_text()
    statements = [stmt.strip() for stmt in raw.split(';') if stmt.strip()]
    return sha256(raw.encode()).hexdigest(), statements


def ensure_schema():
    with app.app_context():
        SchemaMeta.__table__.create(db.engine, checkfirst=True)
        current_hash, statements = _load_schema_script()
        meta = SchemaMeta.query.first()
        if meta and meta.schema_hash == current_hash:
            return

        with db.engine.begin() as conn:
            for stmt in statements:
                conn.execute(text(stmt))

        if meta:
            meta.schema_hash = current_hash
        else:
            db.session.add(SchemaMeta(schema_hash=current_hash))
        db.session.commit()


def _ensure_database_path():
    if DATABASE_URL.startswith('sqlite:'):
        # Ensure data directory exists for SQLite
        db_dir = Path('/app/data')
        db_dir.mkdir(parents=True, exist_ok=True)


def _create_tables():
    with app.app_context():
        if DATABASE_URL.startswith('postgresql'):
            _schema = DB_SCHEMA or 'public'

            @event.listens_for(db.engine, 'connect')
            def _set_search_path(dbapi_conn, _):
                cursor = dbapi_conn.cursor()
                cursor.execute(f'SET search_path TO {_schema}')
                cursor.close()

        db.create_all()


def _run_migrations():
    """Adds columns that don't exist yet on already-deployed tables, without
    touching existing data (unlike ensure_schema's full DROP/CREATE)."""
    with app.app_context():
        inspector = inspect(db.engine)
        if inspector.has_table('specialidad'):
            columns = {col['name'] for col in inspector.get_columns('specialidad')}
            if 'atendido_por_bot' not in columns:
                with db.engine.begin() as conn:
                    conn.execute(text(
                        'ALTER TABLE specialidad ADD COLUMN atendido_por_bot BOOLEAN DEFAULT TRUE NOT NULL'
                    ))
        if inspector.has_table('profesional'):
            columns = {col['name'] for col in inspector.get_columns('profesional')}
            if 'sexo' not in columns:
                with db.engine.begin() as conn:
                    conn.execute(text(
                        'ALTER TABLE profesional ADD COLUMN sexo VARCHAR(20)'
                    ))
            if 'id_profesional' not in columns:
                with db.engine.begin() as conn:
                    conn.execute(text(
                        'ALTER TABLE profesional ADD COLUMN id_profesional INTEGER'
                    ))
                    conn.execute(text(
                        'CREATE UNIQUE INDEX IF NOT EXISTS uq_profesional_id_profesional '
                        'ON profesional(id_profesional)'
                    ))


def _generate_token():
    payload = {
        'sub': ADMIN_USER,
        'exp': datetime.utcnow() + timedelta(hours=12)
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')


def _decode_token(token):
    try:
        return jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except jwt.PyJWTError:
        return None


def requires_auth(func):
    @wraps(func)
    def decorated(*args, **kwargs):
        auth_hdr = request.headers.get('Authorization', '')
        if not auth_hdr.startswith('Bearer '):
            return jsonify({'error': 'Authorization header missing'}), 401
        token = auth_hdr.split(' ', 1)[1]
        payload = _decode_token(token)
        if not payload:
            return jsonify({'error': 'Invalid or expired token'}), 401
        return func(*args, **kwargs)

    return decorated



@app.route('/login', methods=['POST'])
def login():
    data = request.get_json(force=True, silent=True) or {}
    username = data.get('username', '')
    password = data.get('password', '')
    if not username or not password:
        return jsonify({'error': 'Usuario y contraseña obligatorios'}), 400
    if username != ADMIN_USER or password != ADMIN_PASSWORD:
        return jsonify({'error': 'Credenciales inválidas'}), 401
    return jsonify({'token': _generate_token(), 'expires_in': 12 * 60 * 60})


def _serialize_especialidad(item):
    return {
        'id': item.id,
        'especialidad': item.nombre,
        'descripcion': item.descripcion,
        'atendido_por_bot': item.atendido_por_bot,
        'profesionales': [
            {'id': p.id, 'nombre': p.nombre}
            for p in sorted(item.profesionales, key=lambda p: p.nombre.lower())
        ],
        'practicas': [
            {'id': pr.id, 'nombre': pr.nombre}
            for pr in sorted(item.practicas, key=lambda pr: pr.nombre.lower())
        ],
    }


@app.route('/especialidades', methods=['GET'])
@requires_auth
def list_especialidades():
    items = Specialidad.query.order_by(Specialidad.nombre).all()
    return jsonify([_serialize_especialidad(item) for item in items])


@app.route('/especialidades', methods=['POST'])
@requires_auth
def create_especialidad():
    # Las especialidades se dan de alta SOLO desde la importacion (POST /sync/especialidades):
    # su id ES el id de Gacitua, y los turnos se piden con ese id. Una especialidad cargada a
    # mano tendria un id que Gacitua no conoce, el bot la ofreceria igual (esta en el tablero,
    # asi que pasa el gate de atendido_por_bot) y recien al buscar horarios se quedaria sin
    # profesionales. Lo que la clinica hace y Gacitua no agenda va cargado como practica.
    return jsonify({
        'error': 'Las especialidades se importan desde Gacitua. Lo que Gacitua no agenda se carga como práctica.'
    }), 405


@app.route('/especialidades/<int:item_id>', methods=['DELETE'])
@requires_auth
def delete_especialidad(item_id):
    item = Specialidad.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return '', 204


@app.route('/especialidades/<int:item_id>', methods=['PUT'])
@requires_auth
def update_especialidad(item_id):
    item = Specialidad.query.get_or_404(item_id)
    data = request.get_json(force=True, silent=True) or {}
    if 'especialidad' in data:
        nombre = str(data['especialidad']).strip()
        if not nombre:
            return jsonify({'error': 'El nombre de la especialidad es obligatorio'}), 400
        duplicada = Specialidad.query.filter(
            Specialidad.nombre == nombre, Specialidad.id != item.id
        ).first()
        if duplicada:
            return jsonify({'error': 'Ya existe una especialidad con ese nombre'}), 400
        item.nombre = nombre
    if 'descripcion' in data:
        item.descripcion = str(data['descripcion'])
    if 'atendido_por_bot' in data:
        item.atendido_por_bot = bool(data['atendido_por_bot'])
    db.session.commit()
    return jsonify(_serialize_especialidad(item))


# ── Vínculos desde el lado de la especialidad ──────────────────────────────
# La relación ya se edita desde profesionales/prácticas (PUT con
# especialidad_ids). Estos endpoints tocan un solo vínculo por vez para que
# editar desde Especialidades no pise el resto de los campos del otro lado.

def _link(especialidad_id, model, raw_id, id_key, rel_name):
    especialidad = Specialidad.query.get_or_404(especialidad_id)
    try:
        target_id = int(raw_id)
    except (TypeError, ValueError):
        return jsonify({'error': f'{id_key} es obligatorio'}), 400
    target = model.query.get(target_id)
    if not target:
        return jsonify({'error': 'El elemento seleccionado no existe'}), 404
    coleccion = getattr(especialidad, rel_name)
    if target not in coleccion:
        coleccion.append(target)
        db.session.commit()
    return jsonify(_serialize_especialidad(especialidad))


def _unlink(especialidad_id, model, target_id, rel_name):
    especialidad = Specialidad.query.get_or_404(especialidad_id)
    target = model.query.get_or_404(target_id)
    coleccion = getattr(especialidad, rel_name)
    if target in coleccion:
        coleccion.remove(target)
        db.session.commit()
    return jsonify(_serialize_especialidad(especialidad))


@app.route('/especialidades/<int:item_id>/profesionales', methods=['POST'])
@requires_auth
def link_profesional(item_id):
    data = request.get_json(force=True, silent=True) or {}
    return _link(item_id, Profesional, data.get('profesional_id'), 'profesional_id', 'profesionales')


@app.route('/especialidades/<int:item_id>/profesionales/<int:target_id>', methods=['DELETE'])
@requires_auth
def unlink_profesional(item_id, target_id):
    return _unlink(item_id, Profesional, target_id, 'profesionales')


@app.route('/especialidades/<int:item_id>/practicas', methods=['POST'])
@requires_auth
def link_practica(item_id):
    data = request.get_json(force=True, silent=True) or {}
    return _link(item_id, Practica, data.get('practica_id'), 'practica_id', 'practicas')


@app.route('/especialidades/<int:item_id>/practicas/<int:target_id>', methods=['DELETE'])
@requires_auth
def unlink_practica(item_id, target_id):
    return _unlink(item_id, Practica, target_id, 'practicas')


def _normalizar_entrada_especialidad(item):
    """Acepta "NOMBRE" (formato viejo) o {"id_especialidad": 5, "nombre": "CARDIOLOGIA"}."""
    if isinstance(item, dict):
        nombre = str(
            item.get('nombre') or item.get('especialidad') or item.get('nombreEspecialidad') or ''
        ).strip()
        id_gacitua = item.get('id_especialidad')
        if id_gacitua is None:
            id_gacitua = item.get('id')
    else:
        nombre = str(item).strip()
        id_gacitua = None

    if not nombre:
        return None

    try:
        id_gacitua = int(id_gacitua) if id_gacitua not in (None, '') else None
    except (TypeError, ValueError):
        id_gacitua = None

    return {'nombre': nombre, 'id_especialidad': id_gacitua}


def _sincronizar_secuencia(tabla):
    """Al insertar ids explicitos (los de Gacitua) la secuencia del SERIAL no avanza: si
    despues alguien crea una especialidad a mano desde el tablero, el id autoincremental
    arranca en 1 y choca con uno existente. Esto la deja arriba del maximo."""
    if not DATABASE_URL.startswith('postgresql'):
        return
    try:
        db.session.execute(text(
            "SELECT setval(pg_get_serial_sequence('{0}', 'id'), "
            "(SELECT COALESCE(MAX(id), 0) + 1 FROM {0}), false)".format(tabla)
        ))
        db.session.commit()
    except Exception:
        # Si la tabla no usa secuencia, no pasa nada: no es parte del sync.
        db.session.rollback()


@app.route('/sync/especialidades', methods=['POST'])
@requires_auth
def sync_especialidades():
    payload = request.get_json(force=True, silent=True) or {}
    # "especialidades_con_id" es el formato nuevo (trae el id de Gacitua). Se lo manda en
    # una clave aparte a proposito: asi una version vieja de esta API, que solo entiende
    # nombres, sigue leyendo "especialidades" y no rompe nada.
    recibidas = payload.get('especialidades_con_id')
    if not isinstance(recibidas, list):
        recibidas = payload.get('especialidades')
    if not isinstance(recibidas, list):
        return jsonify({'error': 'Se esperaba un array bajo la clave "especialidades"'}), 400

    limpias = [x for x in (_normalizar_entrada_especialidad(i) for i in recibidas) if x]
    if not limpias:
        return jsonify({'error': 'No se recibieron especialidades válidas'}), 400

    unificadas = {}
    for item in limpias:
        clave = (
            ('id', item['id_especialidad']) if item['id_especialidad'] is not None
            else ('nombre', _norm_nombre(item['nombre']))
        )
        unificadas.setdefault(clave, item)

    existentes = Specialidad.query.all()
    por_id = {e.id: e for e in existentes}
    por_nombre = {}
    for e in existentes:
        por_nombre.setdefault(_norm_nombre(e.nombre), e)

    vistas = set()
    creo_con_id = False
    # Filas que ya existian con un id que no es el de Gacitua (p.ej. cargadas a mano antes
    # de que el sync mandara el id). No se les puede cambiar el id sin romper los vinculos,
    # asi que se informan para que se borren y se reimporten.
    desincronizadas = []

    for item in unificadas.values():
        id_gacitua = item['id_especialidad']
        actual = por_id.get(id_gacitua) if id_gacitua is not None else None
        if actual is None:
            actual = por_nombre.get(_norm_nombre(item['nombre']))
            if actual is not None and id_gacitua is not None and actual.id != id_gacitua:
                desincronizadas.append({
                    'nombre': actual.nombre,
                    'id_en_tablero': actual.id,
                    'id_en_gacitua': id_gacitua,
                })

        if actual is None:
            actual = Specialidad(nombre=item['nombre'])
            if id_gacitua is not None:
                # El id de Gacitua ES el id de la especialidad: es el mismo que despues
                # usan las herramientas de turnos (id_especialidad).
                actual.id = id_gacitua
                creo_con_id = True
            db.session.add(actual)
        else:
            # Solo el nombre viene de Gacitua; descripcion y atendido_por_bot son manuales.
            actual.nombre = item['nombre']

        vistas.add(actual)

    # Elimina las especialidades que ya no se reportan
    for obsoleta in [e for e in existentes if e not in vistas]:
        db.session.delete(obsoleta)

    db.session.commit()

    if creo_con_id:
        _sincronizar_secuencia(Specialidad.__tablename__)

    respuesta = {'imported': len(unificadas)}
    if desincronizadas:
        respuesta['desincronizadas'] = desincronizadas
    return jsonify(respuesta)


SEXOS_VALIDOS = {'masculino', 'femenino'}
GENEROS_VALIDOS = {'masculino', 'femenino'}
PRIORIDADES_VALIDAS = {1, 2, 3}


def _resolve_especialidades(ids):
    if not ids:
        return [], None
    if not isinstance(ids, list):
        return None, 'especialidad_ids debe ser una lista'
    try:
        ids = [int(i) for i in ids]
    except (TypeError, ValueError):
        return None, 'especialidad_ids debe contener números'
    items = Specialidad.query.filter(Specialidad.id.in_(ids)).all()
    if len(items) != len(set(ids)):
        return None, 'Alguna especialidad seleccionada no existe'
    return items, None


def _validate_sexo(value):
    if value in (None, ''):
        return None, None
    if value not in SEXOS_VALIDOS:
        return None, 'Sexo inválido'
    return value, None


def _validate_genero(value):
    if value in (None, ''):
        return None, None
    if value not in GENEROS_VALIDOS:
        return None, 'Género inválido'
    return value, None


def _validate_prioridad(value):
    if value in (None, ''):
        return None, None
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None, 'Prioridad inválida'
    if value not in PRIORIDADES_VALIDAS:
        return None, 'Prioridad inválida'
    return value, None


def _to_edad(value):
    if value in (None, ''):
        return None, None
    try:
        value = int(value)
    except (TypeError, ValueError):
        return None, 'Edad inválida'
    if value < 0:
        return None, 'Edad inválida'
    return value, None


def _validate_edad(edad_min, edad_max):
    edad_min, err = _to_edad(edad_min)
    if err:
        return None, None, err
    edad_max, err = _to_edad(edad_max)
    if err:
        return None, None, err
    if edad_min is not None and edad_max is not None and edad_min > edad_max:
        return None, None, 'La edad mínima no puede ser mayor que la máxima'
    return edad_min, edad_max, None


def _serialize_profesional(item):
    return {
        'id': item.id,
        'id_profesional': item.id_profesional,
        'nombre': item.nombre,
        'sexo': item.sexo,
        'especialidad_ids': [e.id for e in item.especialidades],
        'especialidades': [e.nombre for e in item.especialidades],
        'edad_min': item.edad_min,
        'edad_max': item.edad_max,
        'genero': item.genero,
        'prioridad': item.prioridad,
    }


@app.route('/profesionales', methods=['GET'])
@requires_auth
def list_profesionales():
    items = Profesional.query.order_by(
        nullslast(Profesional.prioridad.asc()), Profesional.nombre
    ).all()
    return jsonify([_serialize_profesional(item) for item in items])


@app.route('/profesionales', methods=['POST'])
@requires_auth
def create_profesional():
    # Los profesionales se dan de alta SOLO desde la importacion (POST /sync/profesionales),
    # que es la unica que trae el id_profesional de Gacitua. Un profesional cargado a mano
    # no tendria ese id y el bot no podria buscarle ni reservarle turnos.
    return jsonify({
        'error': 'Los profesionales se importan desde Gacitua. Desde el tablero se editan o se eliminan, no se crean.'
    }), 405


@app.route('/profesionales/<int:item_id>', methods=['PUT'])
@requires_auth
def update_profesional(item_id):
    item = Profesional.query.get_or_404(item_id)
    data = request.get_json(force=True, silent=True) or {}

    if 'nombre' in data:
        nombre = str(data['nombre']).strip()
        if not nombre:
            return jsonify({'error': 'El nombre del profesional es obligatorio'}), 400
        item.nombre = nombre
    if 'especialidad_ids' in data:
        especialidades, err = _resolve_especialidades(data.get('especialidad_ids'))
        if err:
            return jsonify({'error': err}), 400
        item.especialidades = especialidades
    if 'sexo' in data:
        sexo, err = _validate_sexo(data.get('sexo'))
        if err:
            return jsonify({'error': err}), 400
        item.sexo = sexo
    if 'genero' in data:
        genero, err = _validate_genero(data.get('genero'))
        if err:
            return jsonify({'error': err}), 400
        item.genero = genero
    if 'prioridad' in data:
        prioridad, err = _validate_prioridad(data.get('prioridad'))
        if err:
            return jsonify({'error': err}), 400
        item.prioridad = prioridad
    if 'edad_min' in data or 'edad_max' in data:
        edad_min = data.get('edad_min', item.edad_min)
        edad_max = data.get('edad_max', item.edad_max)
        edad_min, edad_max, err = _validate_edad(edad_min, edad_max)
        if err:
            return jsonify({'error': err}), 400
        item.edad_min = edad_min
        item.edad_max = edad_max

    db.session.commit()
    return jsonify(_serialize_profesional(item))


@app.route('/profesionales/<int:item_id>', methods=['DELETE'])
@requires_auth
def delete_profesional(item_id):
    item = Profesional.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return '', 204


def _norm_nombre(value):
    """Nombre comparable: sin dobles espacios y en mayusculas."""
    return ' '.join(str(value or '').split()).upper()


def _normalizar_entrada_profesional(item):
    """Acepta tanto "NOMBRE" (formato viejo) como
    {"id_profesional": 8, "nombre": "...", "especialidades": ["CARDIOLOGIA"]}."""
    if isinstance(item, dict):
        nombre = str(item.get('nombre') or item.get('nombreCompleto') or '').strip()
        id_gacitua = item.get('id_profesional')
        especialidades = item.get('especialidades') or []
    else:
        nombre = str(item).strip()
        id_gacitua = None
        especialidades = []

    if not nombre:
        return None

    try:
        id_gacitua = int(id_gacitua) if id_gacitua not in (None, '') else None
    except (TypeError, ValueError):
        id_gacitua = None

    if not isinstance(especialidades, list):
        especialidades = [especialidades]

    return {
        'nombre': nombre,
        'id_profesional': id_gacitua,
        'especialidades': [str(e).strip() for e in especialidades if str(e).strip()],
    }


@app.route('/sync/profesionales', methods=['POST'])
@requires_auth
def sync_profesionales():
    payload = request.get_json(force=True, silent=True) or {}
    recibidos = payload.get('profesionales')
    if not isinstance(recibidos, list):
        return jsonify({'error': 'Se esperaba un array bajo la clave "profesionales"'}), 400

    limpios = [x for x in (_normalizar_entrada_profesional(i) for i in recibidos) if x]
    if not limpios:
        return jsonify({'error': 'No se recibieron profesionales válidos'}), 400

    # Gacitua devuelve una fila por profesional-especialidad: se unifica por id.
    unificados = {}
    for item in limpios:
        clave = (
            ('id', item['id_profesional']) if item['id_profesional'] is not None
            else ('nombre', _norm_nombre(item['nombre']))
        )
        actual = unificados.setdefault(clave, dict(item, especialidades=[]))
        for esp in item['especialidades']:
            if esp not in actual['especialidades']:
                actual['especialidades'].append(esp)

    existentes = Profesional.query.all()
    por_id = {p.id_profesional: p for p in existentes if p.id_profesional is not None}
    por_nombre = {}
    for p in existentes:
        por_nombre.setdefault(_norm_nombre(p.nombre), p)

    especialidades_por_nombre = {}
    for esp in Specialidad.query.all():
        especialidades_por_nombre.setdefault(_norm_nombre(esp.nombre), esp)

    vistos = set()
    for item in unificados.values():
        actual = por_id.get(item['id_profesional']) if item['id_profesional'] is not None else None
        # Sin match por id puede ser una fila vieja (importada antes de que existiera
        # id_profesional): se la vincula por nombre en vez de duplicarla.
        if actual is None:
            actual = por_nombre.get(_norm_nombre(item['nombre']))

        if actual is None:
            actual = Profesional(nombre=item['nombre'])
            # Las especialidades se setean SOLO al crearlo: despues manda lo que se
            # haya editado a mano en el tablero.
            actual.especialidades = [
                especialidades_por_nombre[_norm_nombre(e)]
                for e in item['especialidades']
                if _norm_nombre(e) in especialidades_por_nombre
            ]
            db.session.add(actual)
        else:
            actual.nombre = item['nombre']

        if item['id_profesional'] is not None:
            actual.id_profesional = item['id_profesional']
        vistos.add(actual)

    # Elimina los profesionales que ya no se reportan
    for obsoleto in [p for p in existentes if p not in vistos]:
        db.session.delete(obsoleto)

    db.session.commit()
    return jsonify({'imported': len(unificados)})


def _serialize_practica(item):
    return {
        'id': item.id,
        'nombre': item.nombre,
        'especialidad_ids': [e.id for e in item.especialidades],
        'especialidades': [e.nombre for e in item.especialidades],
        'descripcion': item.descripcion,
        'atendido_por_bot': item.atendido_por_bot,
    }


@app.route('/practicas', methods=['GET'])
@requires_auth
def list_practicas():
    items = Practica.query.order_by(Practica.nombre).all()
    return jsonify([_serialize_practica(item) for item in items])


@app.route('/practicas', methods=['POST'])
@requires_auth
def create_practica():
    data = request.get_json(force=True, silent=True) or {}
    nombre = str(data.get('nombre', '')).strip()
    if not nombre:
        return jsonify({'error': 'El nombre de la práctica es obligatorio'}), 400

    especialidades, err = _resolve_especialidades(data.get('especialidad_ids', []))
    if err:
        return jsonify({'error': err}), 400

    item = Practica(
        nombre=nombre,
        especialidades=especialidades,
        descripcion=str(data.get('descripcion', '') or ''),
        atendido_por_bot=bool(data.get('atendido_por_bot', True)),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(_serialize_practica(item)), 201


@app.route('/practicas/<int:item_id>', methods=['PUT'])
@requires_auth
def update_practica(item_id):
    item = Practica.query.get_or_404(item_id)
    data = request.get_json(force=True, silent=True) or {}

    if 'nombre' in data:
        nombre = str(data['nombre']).strip()
        if not nombre:
            return jsonify({'error': 'El nombre de la práctica es obligatorio'}), 400
        item.nombre = nombre
    if 'especialidad_ids' in data:
        especialidades, err = _resolve_especialidades(data.get('especialidad_ids'))
        if err:
            return jsonify({'error': err}), 400
        item.especialidades = especialidades
    if 'descripcion' in data:
        item.descripcion = str(data['descripcion'])
    if 'atendido_por_bot' in data:
        item.atendido_por_bot = bool(data['atendido_por_bot'])

    db.session.commit()
    return jsonify(_serialize_practica(item))


@app.route('/practicas/<int:item_id>', methods=['DELETE'])
@requires_auth
def delete_practica(item_id):
    item = Practica.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return '', 204


@app.route('/sync/practicas', methods=['POST'])
@requires_auth
def sync_practicas():
    payload = request.get_json(force=True, silent=True) or {}
    names = payload.get('practicas')
    if not isinstance(names, list):
        return jsonify({'error': 'Se esperaba un array bajo la clave "practicas"'}), 400
    cleaned = [str(n).strip() for n in names if str(n).strip()]
    if not cleaned:
        return jsonify({'error': 'No se recibieron prácticas válidas'}), 400

    existing = {item.nombre: item for item in Practica.query.all()}
    received_set = set(cleaned)

    for name in cleaned:
        if name in existing:
            continue
        db.session.add(Practica(nombre=name))

    # Elimina las prácticas que ya no se reportan
    for obsolete in [item for item in existing.values() if item.nombre not in received_set]:
        db.session.delete(obsolete)

    db.session.commit()
    return jsonify({'imported': len(cleaned)})


@app.route('/clinic', methods=['GET'])
@requires_auth
def get_clinic():
    info = ClinicInfo.query.first()
    if not info:
        info = ClinicInfo()
        db.session.add(info)
        db.session.commit()
    return jsonify({
        'descripcion': info.descripcion,
        'direccion': info.direccion,
        'ubicacion_url': info.ubicacion_url,
        'pagina_web': info.pagina_web,
    })


@app.route('/clinic', methods=['PUT'])
@requires_auth
def update_clinic():
    data = request.get_json(force=True, silent=True) or {}
    info = ClinicInfo.query.first() or ClinicInfo()
    info.descripcion = data.get('descripcion', info.descripcion)
    info.direccion = data.get('direccion', info.direccion)
    info.ubicacion_url = data.get('ubicacion_url', info.ubicacion_url)
    info.pagina_web = data.get('pagina_web', info.pagina_web)
    db.session.add(info)
    db.session.commit()
    return jsonify({
        'descripcion': info.descripcion,
        'direccion': info.direccion,
        'ubicacion_url': info.ubicacion_url,
        'pagina_web': info.pagina_web,
    })


@app.route('/faqs', methods=['GET'])
@requires_auth
def list_faqs():
    faqs = FAQ.query.order_by(FAQ.created_at.desc()).all()
    return jsonify([
        {
            'id': faq.id,
            'question': faq.question,
            'answer': faq.answer,
            'created_at': faq.created_at.isoformat(),
        }
        for faq in faqs
    ])


@app.route('/faqs', methods=['POST'])
@requires_auth
def create_faq():
    data = request.get_json(force=True, silent=True) or {}
    question = data.get('question', '').strip()
    answer = data.get('answer', '').strip()
    if not question or not answer:
        return jsonify({'error': 'Pregunta y respuesta son obligatorias'}), 400
    faq = FAQ(question=question, answer=answer)
    db.session.add(faq)
    db.session.commit()
    return jsonify({'id': faq.id}), 201


@app.route('/faqs/<int:faq_id>', methods=['PUT'])
@requires_auth
def update_faq(faq_id):
    faq = FAQ.query.get_or_404(faq_id)
    data = request.get_json(force=True, silent=True) or {}
    question = data.get('question', '').strip()
    answer = data.get('answer', '').strip()
    if not question or not answer:
        return jsonify({'error': 'Pregunta y respuesta son obligatorias'}), 400
    faq.question = question
    faq.answer = answer
    db.session.commit()
    return jsonify({'id': faq.id, 'question': faq.question, 'answer': faq.answer})


@app.route('/faqs/<int:faq_id>', methods=['DELETE'])
@requires_auth
def delete_faq(faq_id):
    faq = FAQ.query.get_or_404(faq_id)
    db.session.delete(faq)
    db.session.commit()
    return '', 204


@app.route('/textos', methods=['GET'])
@requires_auth
def list_textos():
    items = TextoPredefinido.query.order_by(TextoPredefinido.created_at.desc()).all()
    return jsonify([
        {
            'id': item.id,
            'nombre': item.nombre,
            'texto': item.texto,
            'created_at': item.created_at.isoformat(),
        }
        for item in items
    ])


@app.route('/textos', methods=['POST'])
@requires_auth
def create_texto():
    data = request.get_json(force=True, silent=True) or {}
    nombre = data.get('nombre', '').strip()
    texto = data.get('texto', '').strip()
    if not nombre or not texto:
        return jsonify({'error': 'Nombre y texto son obligatorios'}), 400
    item = TextoPredefinido(nombre=nombre, texto=texto)
    db.session.add(item)
    db.session.commit()
    return jsonify({'id': item.id}), 201


@app.route('/textos/<int:texto_id>', methods=['PUT'])
@requires_auth
def update_texto(texto_id):
    item = TextoPredefinido.query.get_or_404(texto_id)
    data = request.get_json(force=True, silent=True) or {}
    nombre = data.get('nombre', '').strip()
    texto = data.get('texto', '').strip()
    if not nombre or not texto:
        return jsonify({'error': 'Nombre y texto son obligatorios'}), 400
    item.nombre = nombre
    item.texto = texto
    db.session.commit()
    return jsonify({'id': item.id, 'nombre': item.nombre, 'texto': item.texto})


@app.route('/textos/<int:texto_id>', methods=['DELETE'])
@requires_auth
def delete_texto(texto_id):
    item = TextoPredefinido.query.get_or_404(texto_id)
    db.session.delete(item)
    db.session.commit()
    return '', 204


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'ok': True,
        'db': bool(db.engine),
        'version': '0.1'
    })


_ensure_database_path()
_create_tables()
_run_migrations()
ensure_schema()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
