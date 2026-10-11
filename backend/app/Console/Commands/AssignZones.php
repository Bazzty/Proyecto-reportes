<?php

namespace App\Console\Commands;

use App\Models\Report;
use App\Services\ZoneResolver;
use Illuminate\Console\Command;

class AssignZones extends Command
{
    protected $signature = 'zones:assign';

    protected $description = 'Asigna la zona (comuna/sector) a los reportes existentes según sus coordenadas';

    public function handle(ZoneResolver $resolver): int
    {
        $updated = 0;

        Report::query()->chunkById(200, function ($reports) use ($resolver, &$updated) {
            foreach ($reports as $report) {
                $zoneId = $resolver->resolve((float) $report->latitude, (float) $report->longitude)?->id;

                if ($report->zone_id !== $zoneId) {
                    $report->zone_id = $zoneId;
                    $report->save();
                    $updated++;
                }
            }
        });

        $this->info("Reportes actualizados: {$updated}");

        return self::SUCCESS;
    }
}
