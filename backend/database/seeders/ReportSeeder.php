<?php

namespace Database\Seeders;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class ReportSeeder extends Seeder
{
    public function run(): void
    {
        // Usuarios de prueba
        $users = [
            ['name' => 'Bastian Contreras', 'email' => 'bastian@demo.cl'],
            ['name' => 'Catalina Muñoz',    'email' => 'catalina@demo.cl'],
            ['name' => 'Oskar Pérez',        'email' => 'oskar@demo.cl'],
            ['name' => 'Alonso Vera',        'email' => 'alonso@demo.cl'],
        ];

        $createdUsers = [];
        foreach ($users as $u) {
            $createdUsers[] = User::firstOrCreate(
                ['email' => $u['email']],
                ['name' => $u['name'], 'password' => Hash::make('password')]
            );
        }

        $categories = Category::all()->keyBy(fn($c) => strtolower($c->name));

        // Reportes distribuidos por el Lago Llanquihue y comunas aledañas
        $reports = [
            // Puerto Varas — zona costera
            ['lat' => -41.3198, 'lng' => -72.9833, 'cat' => 'basura',    'status' => 'Pendiente',   'desc' => 'Acumulación de basura doméstica en la costanera de Puerto Varas.'],
            ['lat' => -41.3210, 'lng' => -72.9801, 'cat' => 'escombros', 'status' => 'En Progreso', 'desc' => 'Escombros de construcción abandonados en orilla del lago.'],
            ['lat' => -41.3175, 'lng' => -72.9860, 'cat' => 'aguas',     'status' => 'Pendiente',   'desc' => 'Descarga de aguas grises desde tubería rota hacia el lago.'],
            ['lat' => -41.3220, 'lng' => -72.9750, 'cat' => 'basura',    'status' => 'Resuelto',    'desc' => 'Microbasural en estacionamiento del parque municipal.'],
            ['lat' => -41.3190, 'lng' => -72.9900, 'cat' => 'otro',      'status' => 'Pendiente',   'desc' => 'Aceite quemado vertido en calle Los Alamos.'],

            // Frutillar Bajo — zona turística
            ['lat' => -41.1269, 'lng' => -73.0486, 'cat' => 'basura',    'status' => 'Pendiente',   'desc' => 'Botellas plásticas acumuladas en playa de Frutillar Bajo.'],
            ['lat' => -41.1290, 'lng' => -73.0500, 'cat' => 'aguas',     'status' => 'Pendiente',   'desc' => 'Efluente de color turbio fluyendo hacia la costanera.'],
            ['lat' => -41.1250, 'lng' => -73.0460, 'cat' => 'escombros', 'status' => 'En Progreso', 'desc' => 'Restos de demolición bloqueando acceso peatonal.'],
            ['lat' => -41.1310, 'lng' => -73.0520, 'cat' => 'basura',    'status' => 'Resuelto',    'desc' => 'Bolsas de basura en borde costero frente al Teatro del Lago.'],

            // Llanquihue — orilla norte
            ['lat' => -41.2539, 'lng' => -73.0108, 'cat' => 'aguas',     'status' => 'Pendiente',   'desc' => 'Tubería de desagüe rota con vertido directo al lago.'],
            ['lat' => -41.2560, 'lng' => -73.0090, 'cat' => 'basura',    'status' => 'En Progreso', 'desc' => 'Sitio eriazo usado como vertedero clandestino.'],
            ['lat' => -41.2510, 'lng' => -73.0130, 'cat' => 'otro',      'status' => 'Pendiente',   'desc' => 'Tambores de sustancia desconocida en ribera del lago.'],

            // Puerto Octay — extremo norte
            ['lat' => -40.9754, 'lng' => -72.8892, 'cat' => 'basura',    'status' => 'Pendiente',   'desc' => 'Basura doméstica tirada en camino rural hacia el lago.'],
            ['lat' => -40.9780, 'lng' => -72.8870, 'cat' => 'escombros', 'status' => 'Pendiente',   'desc' => 'Materiales de construcción abandonados en terreno fiscal.'],
            ['lat' => -40.9730, 'lng' => -72.8910, 'cat' => 'aguas',     'status' => 'En Progreso', 'desc' => 'Contaminación visible del estero que desemboca en el lago.'],

            // Ensenada — sector volcán Osorno
            ['lat' => -41.2030, 'lng' => -72.5700, 'cat' => 'basura',    'status' => 'Pendiente',   'desc' => 'Residuos sólidos en ruta turística camino al volcán Osorno.'],
            ['lat' => -41.2050, 'lng' => -72.5680, 'cat' => 'otro',      'status' => 'Resuelto',    'desc' => 'Contenedores de basura desbordados en zona de camping.'],

            // Las Cascadas — orilla este
            ['lat' => -41.0900, 'lng' => -72.6800, 'cat' => 'aguas',     'status' => 'Pendiente',   'desc' => 'Residuos agrícolas fluyendo hacia el lago desde parcela.'],
            ['lat' => -41.0870, 'lng' => -72.6830, 'cat' => 'basura',    'status' => 'Pendiente',   'desc' => 'Plásticos y nylon de uso agrícola abandonados en ribera.'],

            // Puerto Montt — acceso sur
            ['lat' => -41.4693, 'lng' => -72.9424, 'cat' => 'escombros', 'status' => 'En Progreso', 'desc' => 'Escombros de obra en calle sin señalización de peligro.'],
            ['lat' => -41.4710, 'lng' => -72.9400, 'cat' => 'basura',    'status' => 'Pendiente',   'desc' => 'Microbasural detrás de supermercado en sector sur.'],
        ];

        foreach ($reports as $i => $r) {
            $cat = $categories->get($r['cat']);
            if (!$cat) continue;

            $user = $createdUsers[$i % count($createdUsers)];

            Report::create([
                'user_id'     => $user->id,
                'category_id' => $cat->id,
                'description' => $r['desc'],
                'latitude'    => $r['lat'],
                'longitude'   => $r['lng'],
                'photo_path'  => null,
                'status'      => $r['status'],
            ]);
        }
    }
}
