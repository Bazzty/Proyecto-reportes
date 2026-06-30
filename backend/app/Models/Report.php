<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Report extends Model
{
    protected $fillable = [
        'user_id',
        'category_id',
        'description',
        'latitude',
        'longitude',
        'photo_path',
        'status',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function category()
    {
        return $this->belongsTo(Category::class);
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
