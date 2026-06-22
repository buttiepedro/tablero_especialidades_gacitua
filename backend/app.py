import os
from datetime import datetime, timedelta
from functools import wraps

import jwt
from bson import ObjectId
from bson.errors import InvalidId
from dotenv import load_dotenv
from flask import Flask, abort, jsonify, request
from flask_cors import CORS
from pymongo import MongoClient

load_dotenv()

app = Flask(__name__, static_folder="static", template_folder="templates")
CORS(app)

app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret')

ADMIN_USER = os.environ.get('ADMIN_USER', 'admin')
ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'changeme')

MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://mongo:27017/tablero')
_client = MongoClient(MONGO_URL)
_db = _client.get_default_database()


def _oid(id_str):
    try:
        return ObjectId(id_str)
    except InvalidId:
        abort(404)


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
    items = list(_db.especialidades.find().sort('nombre', 1))
    return jsonify([
        {'id': str(i['_id']), 'especialidad': i['nombre'], 'descripcion': i.get('descripcion', '')}
        for i in items
    ])


@app.route('/especialidades/<item_id>', methods=['PUT'])
@requires_auth
def update_especialidad(item_id):
    data = request.get_json(force=True, silent=True) or {}
    result = _db.especialidades.find_one_and_update(
        {'_id': _oid(item_id)},
        {'$set': {'descripcion': str(data.get('descripcion', ''))}},
        return_document=True
    )
    if not result:
        abort(404)
    return jsonify({'id': str(result['_id']), 'descripcion': result.get('descripcion', '')})


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

    for name in cleaned:
        _db.especialidades.update_one(
            {'nombre': name},
            {'$setOnInsert': {'nombre': name, 'descripcion': ''}},
            upsert=True
        )
    _db.especialidades.delete_many({'nombre': {'$nin': cleaned}})
    return jsonify({'imported': len(cleaned)})


@app.route('/clinic', methods=['GET'])
@requires_auth
def get_clinic():
    info = _db.clinic_info.find_one()
    if not info:
        _db.clinic_info.insert_one({'descripcion': '', 'direccion': '', 'ubicacion_url': '', 'pagina_web': ''})
        info = _db.clinic_info.find_one()
    return jsonify({
        'descripcion': info.get('descripcion', ''),
        'direccion': info.get('direccion', ''),
        'ubicacion_url': info.get('ubicacion_url', ''),
        'pagina_web': info.get('pagina_web', ''),
    })


@app.route('/clinic', methods=['PUT'])
@requires_auth
def update_clinic():
    data = request.get_json(force=True, silent=True) or {}
    fields = {k: data.get(k, '') for k in ('descripcion', 'direccion', 'ubicacion_url', 'pagina_web')}
    _db.clinic_info.update_one({}, {'$set': fields}, upsert=True)
    return jsonify(fields)


@app.route('/faqs', methods=['GET'])
@requires_auth
def list_faqs():
    faqs = list(_db.faqs.find().sort('created_at', -1))
    return jsonify([
        {'id': str(f['_id']), 'question': f['question'], 'answer': f['answer'],
         'created_at': f['created_at'].isoformat()}
        for f in faqs
    ])


@app.route('/faqs', methods=['POST'])
@requires_auth
def create_faq():
    data = request.get_json(force=True, silent=True) or {}
    question = data.get('question', '').strip()
    answer = data.get('answer', '').strip()
    if not question or not answer:
        return jsonify({'error': 'Pregunta y respuesta son obligatorias'}), 400
    result = _db.faqs.insert_one({'question': question, 'answer': answer, 'created_at': datetime.utcnow()})
    return jsonify({'id': str(result.inserted_id)}), 201


@app.route('/faqs/<faq_id>', methods=['DELETE'])
@requires_auth
def delete_faq(faq_id):
    result = _db.faqs.delete_one({'_id': _oid(faq_id)})
    if result.deleted_count == 0:
        abort(404)
    return '', 204


@app.route('/textos', methods=['GET'])
@requires_auth
def list_textos():
    items = list(_db.textos.find().sort('created_at', -1))
    return jsonify([
        {'id': str(i['_id']), 'nombre': i['nombre'], 'texto': i['texto'],
         'created_at': i['created_at'].isoformat()}
        for i in items
    ])


@app.route('/textos', methods=['POST'])
@requires_auth
def create_texto():
    data = request.get_json(force=True, silent=True) or {}
    nombre = data.get('nombre', '').strip()
    texto = data.get('texto', '').strip()
    if not nombre or not texto:
        return jsonify({'error': 'Nombre y texto son obligatorios'}), 400
    result = _db.textos.insert_one({'nombre': nombre, 'texto': texto, 'created_at': datetime.utcnow()})
    return jsonify({'id': str(result.inserted_id)}), 201


@app.route('/textos/<texto_id>', methods=['DELETE'])
@requires_auth
def delete_texto(texto_id):
    result = _db.textos.delete_one({'_id': _oid(texto_id)})
    if result.deleted_count == 0:
        abort(404)
    return '', 204


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'ok': True, 'db': 'mongo', 'version': '0.2'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
