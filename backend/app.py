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
from sqlalchemy import event, inspect, text

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


class Profesional(db.Model):
    __tablename__ = 'profesionales'
    id = db.Column(db.Integer, primary_key=True)
    nombre_completo = db.Column(db.String(255), nullable=False)
    nombre_especialidad = db.Column(db.String(255), default='')
    nombre_especialidad2 = db.Column(db.String(255), default='')
    nombre_especialidad3 = db.Column(db.String(255), default='')
    id_profesional = db.Column(db.Integer, unique=True, nullable=True)
    notaweb = db.Column(db.Text, default='')
    notaweb_manual = db.Column(db.Text, default='')
    criterio_genero = db.Column(db.String(32), default='')
    criterio_edad_desde = db.Column(db.Integer, nullable=True)
    criterio_edad_hasta = db.Column(db.Integer, nullable=True)
    cargo = db.Column(db.String(255), default='')
    telefono = db.Column(db.String(255), default='')
    email = db.Column(db.String(255), default='')
    descripcion = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    @property
    def notaweb_efectiva(self):
        criteria = build_notaweb_criterio(
            self.criterio_genero,
            self.criterio_edad_desde,
            self.criterio_edad_hasta,
        )
        return criteria or self.notaweb or ''


def build_notaweb_criterio(genero='', edad_desde=None, edad_hasta=None):
    parts = []
    if genero:
        parts.append(f'de género {genero}')
    if edad_desde is not None and edad_hasta is not None:
        parts.append(f'entre {edad_desde} y {edad_hasta} años inclusive')
    elif edad_desde is not None:
        parts.append(f'desde {edad_desde} años')
    elif edad_hasta is not None:
        parts.append(f'hasta {edad_hasta} años inclusive')
    if not parts:
        return ''
    return f"Atiende pacientes {' y '.join(parts)}."


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
            columns = {column['name'] for column in inspect(db.engine).get_columns('profesionales')}
            additions = {
                'nombre_completo': 'VARCHAR(255)',
                'nombre_especialidad': 'VARCHAR(255)',
                'nombre_especialidad2': 'VARCHAR(255)',
                'nombre_especialidad3': 'VARCHAR(255)',
                'id_profesional': 'INTEGER',
                'notaweb': 'TEXT',
                'notaweb_manual': 'TEXT',
                'criterio_genero': 'VARCHAR(32)',
                'criterio_edad_desde': 'INTEGER',
                'criterio_edad_hasta': 'INTEGER',
                'cargo': 'VARCHAR(255)',
                'telefono': 'VARCHAR(255)',
                'email': 'VARCHAR(255)',
                'descripcion': 'TEXT',
            }
            for column, column_type in additions.items():
                if column not in columns:
                    conn.execute(text(f'ALTER TABLE profesionales ADD COLUMN {column} {column_type}'))

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


@app.route('/profesionales', methods=['GET'])
@requires_auth
def list_profesionales():
    items = Profesional.query.order_by(Profesional.nombre_completo).all()
    return jsonify([serialize_profesional(item) for item in items])


def serialize_profesional(item):
    return {
        'id': item.id,
        'nombreCompleto': item.nombre_completo,
        'nombreEspecialidad': item.nombre_especialidad,
        'nombreEspecialidad2': item.nombre_especialidad2,
        'nombreEspecialidad3': item.nombre_especialidad3,
        'id_profesional': item.id_profesional,
        'notaweb': item.notaweb,
        'notaweb_efectiva': item.notaweb_efectiva,
        'criterio_genero': item.criterio_genero,
        'criterio_edad_desde': item.criterio_edad_desde,
        'criterio_edad_hasta': item.criterio_edad_hasta,
        'cargo': item.cargo,
        'telefono': item.telefono,
        'email': item.email,
        'descripcion': item.descripcion,
        # Legacy names remain available to existing API consumers.
        'nombre': item.nombre_completo,
        'especialidad': item.nombre_especialidad,
    }


def profesional_values(data, current=None):
    def value(new_name, old_name, default=''):
        if new_name in data:
            return data[new_name]
        if old_name in data:
            return data[old_name]
        current_name = {
            'nombreCompleto': 'nombre_completo',
            'nombreEspecialidad': 'nombre_especialidad',
        }.get(new_name, new_name)
        return getattr(current, current_name, default) if current else default

    raw_id = value('id_profesional', 'id_profesional', None)
    try:
        professional_id = int(raw_id) if raw_id not in (None, '') else None
    except (TypeError, ValueError):
        professional_id = None

    def age_value(name):
        raw = data.get(name, getattr(current, name, None) if current else None)
        try:
            return int(raw) if raw not in (None, '') else None
        except (TypeError, ValueError):
            return None

    return {
        'nombre_completo': str(value('nombreCompleto', 'nombre')).strip(),
        'nombre_especialidad': str(value('nombreEspecialidad', 'especialidad') or ''),
        'nombre_especialidad2': str(data.get('nombreEspecialidad2', getattr(current, 'nombre_especialidad2', '')) or ''),
        'nombre_especialidad3': str(data.get('nombreEspecialidad3', getattr(current, 'nombre_especialidad3', '')) or ''),
        'id_profesional': professional_id,
        'notaweb': str(data.get('notaweb', getattr(current, 'notaweb', '')) or ''),
        'notaweb_manual': str(data.get('notaweb_manual', getattr(current, 'notaweb_manual', '')) or ''),
        'criterio_genero': str(data.get('criterio_genero', getattr(current, 'criterio_genero', '')) or ''),
        'criterio_edad_desde': age_value('criterio_edad_desde'),
        'criterio_edad_hasta': age_value('criterio_edad_hasta'),
        'cargo': str(data.get('cargo', getattr(current, 'cargo', '')) or ''),
        'telefono': str(data.get('telefono', getattr(current, 'telefono', '')) or ''),
        'email': str(data.get('email', getattr(current, 'email', '')) or ''),
        'descripcion': str(data.get('descripcion', getattr(current, 'descripcion', '')) or ''),
    }


@app.route('/profesionales', methods=['POST'])
@requires_auth
def create_profesional():
    data = request.get_json(force=True, silent=True) or {}
    values = profesional_values(data)
    if not values['nombre_completo']:
        return jsonify({'error': 'El nombre del profesional es obligatorio'}), 400
    item = Profesional(**values)
    db.session.add(item)
    db.session.commit()
    return jsonify(serialize_profesional(item)), 201


@app.route('/profesionales/<int:profesional_id>', methods=['PUT'])
@requires_auth
def update_profesional(profesional_id):
    item = Profesional.query.get_or_404(profesional_id)
    data = request.get_json(force=True, silent=True) or {}
    values = profesional_values(data, item)
    if not values['nombre_completo']:
        return jsonify({'error': 'El nombre del profesional es obligatorio'}), 400
    if (
        values['criterio_edad_desde'] is not None
        and values['criterio_edad_hasta'] is not None
        and values['criterio_edad_desde'] > values['criterio_edad_hasta']
    ):
        return jsonify({'error': 'La edad desde no puede ser mayor que la edad hasta'}), 400
    for field, value in values.items():
        setattr(item, field, value)
    db.session.commit()
    return jsonify(serialize_profesional(item))


@app.route('/profesionales/<int:profesional_id>', methods=['DELETE'])
@requires_auth
def delete_profesional(profesional_id):
    item = Profesional.query.get_or_404(profesional_id)
    db.session.delete(item)
    db.session.commit()
    return '', 204


@app.route('/sync/profesionales', methods=['POST'])
@requires_auth
def sync_profesionales():
    payload = request.get_json(force=True, silent=True) or {}
    if isinstance(payload, list):
        profesionales = payload
    else:
        profesionales = payload.get('profesionales')

    if not isinstance(profesionales, list):
        return jsonify({'error': 'Se esperaba un array bajo la clave "profesionales"'}), 400

    normalized = []
    for item in profesionales:
        if not isinstance(item, dict):
            continue
        values = profesional_values(item)
        if not values['nombre_completo']:
            continue
        normalized.append(values)

    if not normalized:
        return jsonify({'error': 'No se recibieron profesionales válidos'}), 400

    def identity(values):
        return values['id_profesional'] if values['id_profesional'] is not None else ('nombre', values['nombre_completo'])

    existing = {identity({
        'id_profesional': item.id_profesional,
        'nombre_completo': item.nombre_completo,
    }): item for item in Profesional.query.all()}
    received_ids = {identity(item) for item in normalized}

    for item in normalized:
        if identity(item) in existing:
            current = existing[identity(item)]
            for field, value in item.items():
                if field not in ('notaweb_manual', 'criterio_genero', 'criterio_edad_desde', 'criterio_edad_hasta'):
                    setattr(current, field, value)
            continue
        db.session.add(Profesional(**item))

    for obsolete in [item for item in existing.values() if item.id_profesional not in received_ids]:
        db.session.delete(obsolete)

    db.session.commit()
    return jsonify({'imported': len(normalized)})


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
