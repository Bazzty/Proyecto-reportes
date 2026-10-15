<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Zone extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'type',
        'boundary',
        'area',
        'min_lat',
        'max_lat',
        'min_lng',
        'max_lng',
    ];

    protected static function booted(): void
    {
        // La caja envolvente siempre sigue al GeoJSON, venga de donde venga el guardado.
        static::saving(function (Zone $zone) {
            if (! $zone->exists || $zone->isDirty('boundary')) {
                $zone->fill($zone->boundingBox());
            }
        });
    }

    /**
     * @return array{min_lat: float, max_lat: float, min_lng: float, max_lng: float}
     */
    public function boundingBox(): array
    {
        $minLng = $minLat = INF;
        $maxLng = $maxLat = -INF;
        $coordinates = $this->boundary['coordinates'] ?? [];

        // Hojas [lng, lat]: el índice 0 es la longitud y el 1 la latitud.
        array_walk_recursive($coordinates, function ($value, $index) use (&$minLng, &$minLat, &$maxLng, &$maxLat) {
            if ($index === 0) {
                $minLng = min($minLng, $value);
                $maxLng = max($maxLng, $value);
            } elseif ($index === 1) {
                $minLat = min($minLat, $value);
                $maxLat = max($maxLat, $value);
            }
        });

        return [
            'min_lat' => is_finite($minLat) ? (float) $minLat : 0.0,
            'max_lat' => is_finite($maxLat) ? (float) $maxLat : 0.0,
            'min_lng' => is_finite($minLng) ? (float) $minLng : 0.0,
            'max_lng' => is_finite($maxLng) ? (float) $maxLng : 0.0,
        ];
    }

    protected function casts(): array
    {
        return [
            'boundary' => 'array',
            'area' => 'float',
        ];
    }

    public function reports()
    {
        return $this->hasMany(Report::class);
    }
}
