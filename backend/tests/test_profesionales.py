import os
import unittest

os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
os.environ['ADMIN_USER'] = 'admin'
os.environ['ADMIN_PASSWORD'] = 'changeme'
os.environ['SECRET_KEY'] = 'test-secret'

import app as backend_app


class ProfesionalesApiTests(unittest.TestCase):
    def setUp(self):
        self.app_context = backend_app.app.app_context()
        self.app_context.push()
        backend_app.app.config['TESTING'] = True
        backend_app.db.drop_all()
        backend_app.db.create_all()
        self.client = backend_app.app.test_client()
        self.token = self._login()

    def tearDown(self):
        backend_app.db.session.remove()
        backend_app.db.drop_all()
        self.app_context.pop()

    def _login(self):
        response = self.client.post('/login', json={'username': 'admin', 'password': 'changeme'})
        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        return response.get_json()['token']

    def test_list_empty_profesionales(self):
        response = self.client.get('/profesionales', headers={'Authorization': f'Bearer {self.token}'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json(), [])

    def test_create_and_update_profesional(self):
        create_response = self.client.post(
            '/profesionales',
            headers={'Authorization': f'Bearer {self.token}'},
            json={
                'nombre': 'Dra. María López',
                'especialidad': 'Cardiología',
                'cargo': 'Especialista',
                'telefono': '+56912345678',
                'email': 'maria.lopez@example.com',
                'descripcion': 'Cardióloga clínica'
            },
        )
        self.assertEqual(create_response.status_code, 201, create_response.get_data(as_text=True))
        payload = create_response.get_json()
        self.assertEqual(payload['nombre'], 'Dra. María López')

        update_response = self.client.put(
            f"/profesionales/{payload['id']}",
            headers={'Authorization': f'Bearer {self.token}'},
            json={'cargo': 'Jefa de servicio'},
        )
        self.assertEqual(update_response.status_code, 200, update_response.get_data(as_text=True))
        self.assertEqual(update_response.get_json()['cargo'], 'Jefa de servicio')

    def test_delete_profesional(self):
        create_response = self.client.post(
            '/profesionales',
            headers={'Authorization': f'Bearer {self.token}'},
            json={'nombre': 'Dr. José García', 'especialidad': 'Dermatología'},
        )
        profesional_id = create_response.get_json()['id']

        delete_response = self.client.delete(
            f'/profesionales/{profesional_id}',
            headers={'Authorization': f'Bearer {self.token}'},
        )
        self.assertEqual(delete_response.status_code, 204)

    def test_sync_profesionales(self):
        payload = {
            'profesionales': [
                {
                    'nombre': 'Dra. Ana Pérez',
                    'especialidad': 'Pediatría',
                    'cargo': 'Jefa de servicio',
                    'telefono': '+56911111111',
                    'email': 'ana@example.com',
                    'descripcion': 'Pediatra general',
                },
                {
                    'nombre': 'Dr. Luis Gómez',
                    'especialidad': 'Cardiología',
                    'cargo': 'Médico',
                    'telefono': '+56922222222',
                    'email': 'luis@example.com',
                    'descripcion': 'Cardiólogo',
                },
            ]
        }

        response = self.client.post(
            '/sync/profesionales',
            headers={'Authorization': f'Bearer {self.token}'},
            json=payload,
        )

        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        self.assertEqual(response.get_json()['imported'], 2)

        list_response = self.client.get('/profesionales', headers={'Authorization': f'Bearer {self.token}'})
        self.assertEqual(list_response.status_code, 200)
        profesionales = list_response.get_json()
        self.assertEqual(len(profesionales), 2)
        names = {item['nombre'] for item in profesionales}
        self.assertSetEqual(names, {'Dra. Ana Pérez', 'Dr. Luis Gómez'})

    def test_sync_profesionales_accepts_root_array(self):
        payload = [
            {
                'nombre': 'Dra. Carla Rojas',
                'especialidad': 'Neurología',
                'cargo': 'Médico',
                'telefono': '+56933333333',
                'email': 'carla@example.com',
                'descripcion': 'Neuróloga',
            },
            {
                'nombre': 'Dr. Pablo Ruiz',
                'especialidad': 'Ginecología',
                'cargo': 'Jefe de servicio',
                'telefono': '+56944444444',
                'email': 'pablo@example.com',
                'descripcion': 'Ginecólogo',
            },
        ]

        response = self.client.post(
            '/sync/profesionales',
            headers={'Authorization': f'Bearer {self.token}'},
            json=payload,
        )

        self.assertEqual(response.status_code, 200, response.get_data(as_text=True))
        self.assertEqual(response.get_json()['imported'], 2)


if __name__ == '__main__':
    unittest.main()
