<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Confirmation extends Model
{
    protected $fillable = ['user_id', 'report_id'];

    public function user()   { return $this->belongsTo(User::class); }
    public function report() { return $this->belongsTo(Report::class); }
}
