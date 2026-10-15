<?php

namespace App\Services;

use App\Models\Report;
use App\Models\Zone;

class ZoneResolver
{
    public function resolve(?float $latitude, ?float $longitude): ?Zone
    {
        if ($latitude === null || $longitude === null) {
            return null;
        }

        // Solo se cargan (con su GeoJSON) las zonas cuya caja envolvente contiene el punto.
        $matches = Zone::query()
            ->where('min_lat', '<=', $latitude)->where('max_lat', '>=', $latitude)
            ->where('min_lng', '<=', $longitude)->where('max_lng', '>=', $longitude)
            ->get()
            ->filter(fn (Zone $zone) => $this->contains($zone->boundary, $latitude, $longitude));

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
