<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Datos esenciales: se siembran siempre, también en producción.
        $this->call([
            CategorySeeder::class,
            ZoneSeeder::class,
        ]);

        // Datos de demo (usuarios con contraseña "password", un admin y reportes de ejemplo):
        // nunca en producción.
        if (! app()->isProduction()) {
            $this->call(ReportSeeder::class);
        }
    }
}
