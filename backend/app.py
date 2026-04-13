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
from sqlalchemy import text

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///data/especialidades.db')
app.config['SQLALCHEMY_DATABASE_URI'] = DATABASE_URL
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret')

ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'changeme')

db = SQLAlchemy(app)


class Specialidad(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    nombre = db.Column(db.String(255), unique=True, nullable=False)
    activo = db.Column(db.Boolean, nullable=False, default=False)
    descripcion = db.Column(db.Text, default='')
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
        path = DATABASE_URL.replace('sqlite:///', '', 1)
        if path:
            Path(path).parent.mkdir(parents=True, exist_ok=True)


def _create_tables():
    with app.app_context():
        db.create_all()


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
        {'id': item.id, 'especialidad': item.nombre, 'activo': item.activo, 'descripcion': item.descripcion}
        for item in items
    ]
    return jsonify(payload)


@app.route('/especialidades/<int:item_id>', methods=['PUT'])
@requires_auth
def update_especialidad(item_id):
    item = Specialidad.query.get_or_404(item_id)
    data = request.get_json(force=True, silent=True) or {}
    if 'activo' in data:
        item.activo = bool(data['activo'])
    if 'descripcion' in data:
        item.descripcion = str(data['descripcion'])
    db.session.commit()
    return jsonify({'id': item.id, 'activo': item.activo, 'descripcion': item.descripcion})


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


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'ok': True,
        'db': bool(db.engine),
        'version': '0.1'
    })


_ensure_database_path()
_create_tables()
ensure_schema()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
