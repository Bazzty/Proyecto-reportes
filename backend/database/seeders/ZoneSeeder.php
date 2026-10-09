<?php

namespace Database\Seeders;

use App\Models\Zone;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class ZoneSeeder extends Seeder
{
    public function run(): void
    {
        $path = database_path('data/zones.geojson');

        if (! is_file($path)) {
            return;
        }

        $data = json_decode(file_get_contents($path), true);

        foreach ($data['features'] ?? [] as $feature) {
            Zone::updateOrCreate(
                ['slug' => Str::slug($feature['properties']['name'])],
                [
                    'name' => $feature['properties']['name'],
                    'type' => $feature['properties']['type'],
                    'boundary' => $feature['geometry'],
                    'area' => $this->area($feature['geometry']),
                ]
            );
        }
    }

    private function area(array $geometry): float
    {
        $coordinates = $geometry['coordinates'] ?? [];
        $polygons = ($geometry['type'] ?? null) === 'Polygon' ? [$coordinates] : $coordinates;

        $total = 0.0;
        foreach ($polygons as $polygon) {
            if (($polygon[0] ?? []) !== []) {
                $total += $this->ringArea($polygon[0]);
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
