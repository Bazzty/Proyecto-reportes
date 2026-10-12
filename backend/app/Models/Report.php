<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    protected $fillable = [
        'user_id',
        'client_uuid',
        'category_id',
        'zone_id',
        'description',
        'latitude',
        'longitude',
        'photo_path',
        'status',
        'validation_status',
        'validated_by',
        'validated_at',
        'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'validated_at' => 'datetime',
        ];
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    public function zone()
    {
        return $this->belongsTo(Zone::class);
    }

    public function validatedBy()
    {
        return $this->belongsTo(User::class, 'validated_by');
    }

    public function confirmations()
    {
        return $this->hasMany(Confirmation::class);
    }

    public function comments()
    {
        return $this->hasMany(Comment::class);
    }
}
