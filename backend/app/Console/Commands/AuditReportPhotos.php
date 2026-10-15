<?php

namespace App\Console\Commands;

use App\Models\Report;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class AuditReportPhotos extends Command
{
    protected $signature = 'reports:audit-photos';

    protected $description = 'Verifica que el photo_path de cada reporte exista en el disco público (REP-59)';

    public function handle(): int
    {
        $disk = Storage::disk('public');
        $missing = [];

        Report::whereNotNull('photo_path')
            ->where('photo_path', '!=', '')
            ->select(['id', 'photo_path'])
            ->chunkById(500, function ($reports) use ($disk, &$missing) {
                foreach ($reports as $report) {
                    if (! $disk->exists($report->photo_path)) {
                        $missing[] = [$report->id, $report->photo_path];
                    }
                }
            });

        if ($missing === []) {
            $this->info('Todas las fotos de reportes existen en disco.');

            return self::SUCCESS;
        }

        $this->table(['report_id', 'photo_path'], $missing);
        $this->error(count($missing).' reporte(s) apuntan a una foto que no existe en disco.');

        return self::FAILURE;
    }
}
