<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Borra los tokens de Sanctum vencidos hace más de un día (SANCTUM_EXPIRATION): sin esto la tabla
// crece con una fila por inicio de sesión. Lo ejecuta el servicio "scheduler" de docker-compose.prod.yml.
Schedule::command('sanctum:prune-expired --hours=24')->daily();
