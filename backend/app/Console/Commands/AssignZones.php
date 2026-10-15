<?php

namespace App\Console\Commands;

use App\Models\Zone;
use App\Services\ZoneResolver;
use Illuminate\Console\Command;

class AssignZones extends Command
{
    protected $signature = 'zones:assign';

    protected $description = 'Asigna la zona (comuna/sector) a los reportes existentes según sus coordenadas';

    public function handle(ZoneResolver $resolver): int
    {
        if (Zone::count() === 0) {
            $this->error('No hay zonas cargadas. Ejecuta primero: php artisan db:seed --class=ZoneSeeder');

            return self::FAILURE;
        }

        $updated = $resolver->assignToReports();

        $this->info("Reportes actualizados: {$updated}");

        return self::SUCCESS;
    }
}
