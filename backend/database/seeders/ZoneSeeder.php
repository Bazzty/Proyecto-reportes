<?php

namespace Database\Seeders;

use App\Models\Zone;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;
use RuntimeException;

class ZoneSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('data/zones.geojson');

        if (! is_file($path)) {
            throw new RuntimeException("No se encontró {$path}; es necesario para sembrar las zonas del heatmap.");
        }

        $data = json_decode(file_get_contents($path), true);
        $used = [];

        foreach ($data['features'] ?? [] as $feature) {
            $name = $feature['properties']['name'] ?? null;
            $type = $feature['properties']['type'] ?? null;

            if ($name === null || $type === null || empty($feature['geometry'])) {
                throw new RuntimeException('Feature inválido en zones.geojson: requiere properties.name, properties.type y geometry.');
            }

            $slug = $this->uniqueSlug(Str::slug($name), $type, $used);

            Zone::updateOrCreate(
                ['slug' => $slug],
                [
                    'name' => $name,
                    'type' => $type,
                    'boundary' => $feature['geometry'],
                    'area' => $this->area($feature['geometry']),
                ]
            );
        }

        // Elimina zonas que ya no están en el archivo; sus reportes quedan sin zona (re-ejecutar zones:assign).
        Zone::whereNotIn('slug', array_keys($used))->delete();

        Cache::forget('zones.all');
    }

    /**
     * @param  array<string, bool>  $used
     */
    private function uniqueSlug(string $base, string $type, array &$used): string
    {
        $slug = $base;

        if (isset($used[$slug])) {
            $slug = $base.'-'.$type;
        }

        $i = 2;
        while (isset($used[$slug])) {
            $slug = $base.'-'.$type.'-'.$i++;
        }

        $used[$slug] = true;

        return $slug;
    }

    private function area(array $geometry): float
    {
        $coordinates = $geometry['coordinates'] ?? [];
        $polygons = ($geometry['type'] ?? null) === 'Polygon' ? [$coordinates] : $coordinates;

        $total = 0.0;
        foreach ($polygons as $polygon) {
            if (($polygon[0] ?? []) !== []) {
                $total += $this->ringArea($polygon[0]);

                // Los anillos siguientes son huecos.
                foreach (array_slice($polygon, 1) as $hole) {
                    $total -= $this->ringArea($hole);
                }
            }
        }

        return round($total, 4);
    }

    private function ringArea(array $ring): float
    {
        $count = count($ring);
        if ($count < 3) {
            return 0.0;
        }

        $sum = 0.0;
        for ($i = 0; $i < $count - 1; $i++) {
            $x1 = (float) $ring[$i][0];
            $y1 = (float) $ring[$i][1];
            $x2 = (float) $ring[$i + 1][0];
            $y2 = (float) $ring[$i + 1][1];
            $sum += ($x1 * $y2) - ($x2 * $y1);
        }

        $degreesSquared = abs($sum) / 2;
        $kmPerDegreeLat = 110.57;
        $kmPerDegreeLng = 111.32 * cos(deg2rad((float) $ring[0][1]));

        return $degreesSquared * $kmPerDegreeLat * $kmPerDegreeLng;
    }
}
