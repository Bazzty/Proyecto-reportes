<?php

namespace App\Console\Commands;

use App\Models\Report;
use Illuminate\Console\Command;
use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Storage;

class AuditReportPhotos extends Command
{
    protected $signature = 'reports:audit-photos {--orphans : Además lista los archivos de photos/ que ningún reporte referencia (solo lista, no borra)}';

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

        if ($this->option('orphans')) {
            $this->listOrphans($disk);
        }

        if ($missing === []) {
            $this->info('Todas las fotos de reportes existen en disco.');

            return self::SUCCESS;
        }

        $this->table(['report_id', 'photo_path'], $missing);
        $this->error(count($missing).' reporte(s) apuntan a una foto que no existe en disco.');

        return self::FAILURE;
    }

    /** Archivos bajo photos/ que ningún reports.photo_path referencia. No borra nada. */
    private function listOrphans(Filesystem $disk): void
    {
        $referenced = [];
        Report::whereNotNull('photo_path')
            ->where('photo_path', '!=', '')
            ->select(['id', 'photo_path'])
            ->chunkById(500, function ($reports) use (&$referenced) {
                foreach ($reports as $report) {
                    $referenced[$report->photo_path] = true;
                }
            });

        $orphans = [];
        foreach ($disk->allFiles('photos') as $file) {
            if (! isset($referenced[$file])) {
                $orphans[] = [$file];
            }
        }

        if ($orphans === []) {
            $this->info('No hay fotos huérfanas en disco.');

            return;
        }

        $this->table(['archivo huérfano'], $orphans);
        $this->warn(count($orphans).' archivo(s) en photos/ no están referenciados por ningún reporte.');
    }
}
