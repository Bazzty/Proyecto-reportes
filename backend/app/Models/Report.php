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
        'status_updated_by',
        'status_updated_at',
    ];

    protected function casts(): array
    {
        return [
            'validated_at' => 'datetime',
            'status_updated_at' => 'datetime',
        ];
    }

    /**
     * Solo los reportes validados son públicos. Uno pendiente o rechazado
     * lo ven únicamente su dueño y los administradores.
     */
    public function isVisibleTo(?User $user): bool
    {
        if ($this->validation_status === 'valido') {
            return true;
        }

        return $user !== null && ($user->isAdmin() || $user->id === $this->user_id);
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

    public function statusUpdatedBy()
    {
        return $this->belongsTo(User::class, 'status_updated_by');
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
