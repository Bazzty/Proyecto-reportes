<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Models\Zone;
use App\Services\ZoneResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Cache;

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

        // Evita usar zonas cacheadas desactualizadas.
        Cache::forget('zones.all');

        $updated = 0;

        Report::query()->chunkById(200, function ($reports) use ($resolver, &$updated) {
            foreach ($reports as $report) {
                $zoneId = $resolver->resolve((float) $report->latitude, (float) $report->longitude)?->id;

                if ($report->zone_id !== $zoneId) {
                    // toBase() evita que Eloquent actualice updated_at en el backfill.
                    Report::whereKey($report->id)->toBase()->update(['zone_id' => $zoneId]);
                    $updated++;
                }
            }
        });

        $this->info("Reportes actualizados: {$updated}");

        return self::SUCCESS;
    }
}
