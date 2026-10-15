<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Zone;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Cache;

class ZoneResolver
{
    private ?Collection $zones = null;

    /** @var array<int, array{0: float, 1: float, 2: float, 3: float}> [minLng, minLat, maxLng, maxLat] por zona */
    private array $boxes = [];

    public function resolve(?float $latitude, ?float $longitude): ?Zone
    {
        if ($latitude === null || $longitude === null) {
            return null;
        }

        $matches = $this->zones()
            ->filter(fn (Zone $zone) => $this->inBoundingBox($zone, $latitude, $longitude)
                && $this->contains($zone->boundary, $latitude, $longitude))
            ->values();

        if ($matches->isEmpty()) {
            return null;
        }

        // Prioridad: un sector (más específico) gana sobre una comuna; ante empate, la zona más pequeña.
        return $matches
            ->sort(fn (Zone $a, Zone $b) => [$a->type === 'sector' ? 0 : 1, $a->area] <=> [$b->type === 'sector' ? 0 : 1, $b->area])
            ->first();
    }

    /**
     * Asigna (o limpia) la zona de todos los reportes según sus coordenadas.
     * Usa la query base para no modificar updated_at. Devuelve cuántos reportes cambiaron.
     */
    public function assignToReports(): int
    {
        $this->flush();

        $updated = 0;

        Report::query()->chunkById(200, function ($reports) use (&$updated) {
            foreach ($reports as $report) {
                $zoneId = $this->resolve((float) $report->latitude, (float) $report->longitude)?->id;

                if ($report->zone_id !== $zoneId) {
                    Report::whereKey($report->id)->toBase()->update(['zone_id' => $zoneId]);
                    $updated++;
                }
            }
        });

        return $updated;
    }

    /**
     * Descarta las zonas en memoria y en cache (llamar tras sembrar o modificar zonas).
     */
    public function flush(): void
    {
        $this->zones = null;
        $this->boxes = [];

        Cache::forget('zones.all');
    }

    private function zones(): Collection
    {
        return $this->zones ??= Cache::remember('zones.all', now()->addHour(), fn () => Zone::all());
    }

    private function inBoundingBox(Zone $zone, float $latitude, float $longitude): bool
    {
        $this->boxes[$zone->id] ??= $this->boundingBox($zone->boundary);

        [$minLng, $minLat, $maxLng, $maxLat] = $this->boxes[$zone->id];

        return $longitude >= $minLng && $longitude <= $maxLng && $latitude >= $minLat && $latitude <= $maxLat;
    }

    private function boundingBox(array $geometry): array
    {
        $minLng = $minLat = INF;
        $maxLng = $maxLat = -INF;

        $coordinates = $geometry['coordinates'] ?? [];

        array_walk_recursive($coordinates, function ($value, $index) use (&$minLng, &$minLat, &$maxLng, &$maxLat) {
            // Los pares [lng, lat] se recorren de forma plana; el índice 0 es lng y el 1 es lat.
            if ($index === 0) {
                $minLng = min($minLng, $value);
                $maxLng = max($maxLng, $value);
            } elseif ($index === 1) {
                $minLat = min($minLat, $value);
                $maxLat = max($maxLat, $value);
            }
        });

        return [(float) $minLng, (float) $minLat, (float) $maxLng, (float) $maxLat];
    }

    private function contains(array $geometry, float $latitude, float $longitude): bool
    {
        $type = $geometry['type'] ?? null;
        $coordinates = $geometry['coordinates'] ?? [];

        if ($type === 'Polygon') {
            return $this->inPolygon($coordinates, $latitude, $longitude);
        }

        if ($type === 'MultiPolygon') {
            foreach ($coordinates as $polygon) {
                if ($this->inPolygon($polygon, $latitude, $longitude)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @param  array  $polygon  Lista de anillos: el primero es el contorno y el resto son huecos.
     */
    private function inPolygon(array $polygon, float $latitude, float $longitude): bool
    {
        if ($polygon === []) {
            return false;
        }

        if (! $this->pointInRing($polygon[0], $latitude, $longitude)) {
            return false;
        }

        for ($i = 1; $i < count($polygon); $i++) {
            if ($this->pointInRing($polygon[$i], $latitude, $longitude)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Ray-casting sobre un anillo de coordenadas [lng, lat].
     */
    private function pointInRing(array $ring, float $latitude, float $longitude): bool
    {
        $inside = false;
        $count = count($ring);

        for ($i = 0, $j = $count - 1; $i < $count; $j = $i++) {
            $xi = (float) $ring[$i][0];
            $yi = (float) $ring[$i][1];
            $xj = (float) $ring[$j][0];
            $yj = (float) $ring[$j][1];

            $crosses = (($yi > $latitude) !== ($yj > $latitude))
                && ($longitude < ($xj - $xi) * ($latitude - $yi) / ($yj - $yi) + $xi);

            if ($crosses) {
                $inside = ! $inside;
            }
        }

        return $inside;
    }
}
