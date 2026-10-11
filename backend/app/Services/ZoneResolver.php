<?php

namespace App\Services;

use App\Models\Zone;
use Illuminate\Support\Collection;

class ZoneResolver
{
    private ?Collection $zones = null;

    public function resolve(?float $latitude, ?float $longitude): ?Zone
    {
        if ($latitude === null || $longitude === null) {
            return null;
        }

        $matches = $this->zones()
            ->filter(fn (Zone $zone) => $this->contains($zone->boundary, $latitude, $longitude))
            ->values();

        if ($matches->isEmpty()) {
            return null;
        }

        // Prioridad: un sector (más específico) gana sobre una comuna; ante empate, la zona más pequeña.
        return $matches
            ->sortBy(fn (Zone $zone) => ($zone->type === 'sector' ? 0 : 1) * 1_000_000_000 + $zone->area)
            ->first();
    }

    private function zones(): Collection
    {
        return $this->zones ??= Zone::all();
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
