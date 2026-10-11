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
    ];

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
