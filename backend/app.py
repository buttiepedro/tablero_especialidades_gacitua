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
    nombre = db.Column(db.String(255), nullable=False)
    especialidad = db.Column(db.String(255), default='')
    cargo = db.Column(db.String(255), default='')
    telefono = db.Column(db.String(255), default='')
    email = db.Column(db.String(255), default='')
    descripcion = db.Column(db.Text, default='')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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
    items = Profesional.query.order_by(Profesional.nombre).all()
    return jsonify([
        {
            'id': item.id,
            'nombre': item.nombre,
            'especialidad': item.especialidad,
            'cargo': item.cargo,
            'telefono': item.telefono,
            'email': item.email,
            'descripcion': item.descripcion,
        }
        for item in items
    ])


@app.route('/profesionales', methods=['POST'])
@requires_auth
def create_profesional():
    data = request.get_json(force=True, silent=True) or {}
    nombre = str(data.get('nombre', '')).strip()
    if not nombre:
        return jsonify({'error': 'El nombre del profesional es obligatorio'}), 400
    item = Profesional(
        nombre=nombre,
        especialidad=str(data.get('especialidad', '') or ''),
        cargo=str(data.get('cargo', '') or ''),
        telefono=str(data.get('telefono', '') or ''),
        email=str(data.get('email', '') or ''),
        descripcion=str(data.get('descripcion', '') or ''),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify({
        'id': item.id,
        'nombre': item.nombre,
        'especialidad': item.especialidad,
        'cargo': item.cargo,
        'telefono': item.telefono,
        'email': item.email,
        'descripcion': item.descripcion,
    }), 201


@app.route('/profesionales/<int:profesional_id>', methods=['PUT'])
@requires_auth
def update_profesional(profesional_id):
    item = Profesional.query.get_or_404(profesional_id)
    data = request.get_json(force=True, silent=True) or {}
    nombre = str(data.get('nombre', item.nombre)).strip()
    if not nombre:
        return jsonify({'error': 'El nombre del profesional es obligatorio'}), 400
    item.nombre = nombre
    if 'especialidad' in data:
        item.especialidad = str(data['especialidad'] or '')
    if 'cargo' in data:
        item.cargo = str(data['cargo'] or '')
    if 'telefono' in data:
        item.telefono = str(data['telefono'] or '')
    if 'email' in data:
        item.email = str(data['email'] or '')
    if 'descripcion' in data:
        item.descripcion = str(data['descripcion'] or '')
    db.session.commit()
    return jsonify({
        'id': item.id,
        'nombre': item.nombre,
        'especialidad': item.especialidad,
        'cargo': item.cargo,
        'telefono': item.telefono,
        'email': item.email,
        'descripcion': item.descripcion,
    })


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
        nombre = str(item.get('nombre', '')).strip()
        if not nombre:
            continue
        normalized.append({
            'nombre': nombre,
            'especialidad': str(item.get('especialidad', '') or ''),
            'cargo': str(item.get('cargo', '') or ''),
            'telefono': str(item.get('telefono', '') or ''),
            'email': str(item.get('email', '') or ''),
            'descripcion': str(item.get('descripcion', '') or ''),
        })

    if not normalized:
        return jsonify({'error': 'No se recibieron profesionales válidos'}), 400

    existing = {item.nombre: item for item in Profesional.query.all()}
    received_names = {item['nombre'] for item in normalized}

    for item in normalized:
        if item['nombre'] in existing:
            current = existing[item['nombre']]
            current.especialidad = item['especialidad']
            current.cargo = item['cargo']
            current.telefono = item['telefono']
            current.email = item['email']
            current.descripcion = item['descripcion']
            continue
        db.session.add(Profesional(**item))

    for obsolete in [item for item in existing.values() if item.nombre not in received_names]:
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
