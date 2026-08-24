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

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///data/especialidades.db')
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
    nombre = db.Column(db.String(255), nullable=False)
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
    if DATABASE_URL.startswith('sqlite:///'):
        with app.app_context():
            db_file = db.engine.url.database
        if db_file:
            Path(db_file).parent.mkdir(parents=True, exist_ok=True)


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
        if not inspector.has_table('specialidad'):
            return
        columns = {col['name'] for col in inspector.get_columns('specialidad')}
        if 'atendido_por_bot' not in columns:
            with db.engine.begin() as conn:
                conn.execute(text(
                    'ALTER TABLE specialidad ADD COLUMN atendido_por_bot BOOLEAN DEFAULT TRUE NOT NULL'
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


@app.route('/especialidades', methods=['GET'])
@requires_auth
def list_especialidades():
    items = Specialidad.query.order_by(Specialidad.nombre).all()
    payload = [
        {
            'id': item.id,
            'especialidad': item.nombre,
            'descripcion': item.descripcion,
            'atendido_por_bot': item.atendido_por_bot,
        }
        for item in items
    ]
    return jsonify(payload)


@app.route('/especialidades', methods=['POST'])
@requires_auth
def create_especialidad():
    data = request.get_json(force=True, silent=True) or {}
    nombre = str(data.get('especialidad', '')).strip()
    if not nombre:
        return jsonify({'error': 'El nombre de la especialidad es obligatorio'}), 400
    if Specialidad.query.filter_by(nombre=nombre).first():
        return jsonify({'error': 'Ya existe una especialidad con ese nombre'}), 400
    item = Specialidad(
        nombre=nombre,
        descripcion=str(data.get('descripcion', '') or ''),
        atendido_por_bot=bool(data.get('atendido_por_bot', True)),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify({
        'id': item.id,
        'especialidad': item.nombre,
        'descripcion': item.descripcion,
        'atendido_por_bot': item.atendido_por_bot,
    }), 201


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
    return jsonify({
        'id': item.id,
        'especialidad': item.nombre,
        'descripcion': item.descripcion,
        'atendido_por_bot': item.atendido_por_bot,
    })


@app.route('/sync/especialidades', methods=['POST'])
@requires_auth
def sync_especialidades():
    payload = request.get_json(force=True, silent=True) or {}
    names = payload.get('especialidades')
    if not isinstance(names, list):
        return jsonify({'error': 'Se esperaba un array bajo la clave "especialidades"'}), 400
    cleaned = [str(n).strip() for n in names if str(n).strip()]
    if not cleaned:
        return jsonify({'error': 'No se recibieron especialidades válidas'}), 400

    existing = {item.nombre: item for item in Specialidad.query.all()}
    received_set = set(cleaned)

    for name in cleaned:
        if name in existing:
            continue
        db.session.add(Specialidad(nombre=name))

    # Remove specialties that are no longer reported
    for obsolete in [item for item in existing.values() if item.nombre not in received_set]:
        db.session.delete(obsolete)

    db.session.commit()
    return jsonify({'imported': len(cleaned)})


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
        'nombre': item.nombre,
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
    data = request.get_json(force=True, silent=True) or {}
    nombre = str(data.get('nombre', '')).strip()
    if not nombre:
        return jsonify({'error': 'El nombre del profesional es obligatorio'}), 400

    especialidades, err = _resolve_especialidades(data.get('especialidad_ids', []))
    if err:
        return jsonify({'error': err}), 400
    genero, err = _validate_genero(data.get('genero'))
    if err:
        return jsonify({'error': err}), 400
    prioridad, err = _validate_prioridad(data.get('prioridad'))
    if err:
        return jsonify({'error': err}), 400
    edad_min, edad_max, err = _validate_edad(data.get('edad_min'), data.get('edad_max'))
    if err:
        return jsonify({'error': err}), 400

    item = Profesional(
        nombre=nombre,
        especialidades=especialidades,
        edad_min=edad_min,
        edad_max=edad_max,
        genero=genero,
        prioridad=prioridad,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(_serialize_profesional(item)), 201


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


@app.route('/sync/profesionales', methods=['POST'])
@requires_auth
def sync_profesionales():
    payload = request.get_json(force=True, silent=True) or {}
    names = payload.get('profesionales')
    if not isinstance(names, list):
        return jsonify({'error': 'Se esperaba un array bajo la clave "profesionales"'}), 400
    cleaned = [str(n).strip() for n in names if str(n).strip()]
    if not cleaned:
        return jsonify({'error': 'No se recibieron profesionales válidos'}), 400

    existing = {item.nombre: item for item in Profesional.query.all()}
    received_set = set(cleaned)

    for name in cleaned:
        if name in existing:
            continue
        db.session.add(Profesional(nombre=name))

    # Elimina los profesionales que ya no se reportan
    for obsolete in [item for item in existing.values() if item.nombre not in received_set]:
        db.session.delete(obsolete)

    db.session.commit()
    return jsonify({'imported': len(cleaned)})


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
