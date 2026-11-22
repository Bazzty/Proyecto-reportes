<?php

use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // La app solo es accesible a través del contenedor nginx / el túnel (ngrok), así que
        // se confía en sus cabeceras X-Forwarded-*; sin esto las URLs generadas salen en http://.
        $middleware->trustProxies(at: '*');

        $middleware->alias([
            'admin' => EnsureUserIsAdmin::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // El mensaje por defecto ("Too Many Attempts.") llega en inglés a la app.
        $exceptions->render(function (ThrottleRequestsException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(
                    ['message' => 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.'],
                    429,
                    $e->getHeaders()
                );
            }
        });

        // 404 uniforme: un id inexistente (ModelNotFoundException llega aquí como NotFoundHttpException)
        // y un reporte oculto (abort(404)) devuelven el mismo cuerpo, sin filtrar "No query results".
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                $message = $request->is('api/*reports*') ? 'Reporte no encontrado.' : 'Recurso no encontrado.';

                return response()->json(['message' => $message], 404);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) {
            if ($request->is('api/*') || $request->expectsJson()) {
                return response()->json(['message' => 'No autenticado.'], 401);
            }
        });
    })->create();
