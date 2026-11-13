<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Los controladores tipan $id como int: un id no numérico ("/reports/abc") debe dar 404,
        // no un TypeError (500).
        Route::pattern('id', '[0-9]+');

        // Por email + IP: una IP compartida (NAT de la universidad) no bloquea a todos los usuarios.
        RateLimiter::for('login', fn (Request $request) => Limit::perMinute(5)
            ->by(strtolower((string) $request->input('email')).'|'.$request->ip()));

        // Crear reportes, por usuario: de sobra para uso real (la cola offline reintenta un 429 más
        // tarde) y corta un script que suba fotos de 5 MB en bucle.
        RateLimiter::for('reports', fn (Request $request) => [
            Limit::perMinute(10)->by('reports-min|'.$request->user()?->id),
            Limit::perHour(60)->by('reports-hour|'.$request->user()?->id),
        ]);

        // Lecturas públicas, por IP. Cada teléfono hace ~15 por minuto (sondeo cada 5 s), así que el
        // tope admite unos 40 detrás de la misma IP (una sala con NAT) y frena a un script.
        RateLimiter::for('public', fn (Request $request) => Limit::perMinute(600)->by($request->ip()));
    }
}
