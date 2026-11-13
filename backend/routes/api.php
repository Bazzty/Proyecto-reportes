<?php

use App\Http\Controllers\AdminReportController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoryController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\ConfirmationController;
use App\Http\Controllers\ReportController;
use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:10,1');
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::get('/categories', [CategoryController::class, 'index']);
Route::get('/reports/heatmap', [ReportController::class, 'heatmap']);
// Huella barata de los datos del mapa: la app solo vuelve a pedir los listados si cambió.
Route::get('/reports/version', [ReportController::class, 'version']);
Route::get('/reports', [ReportController::class, 'index']);
Route::get('/reports/{id}', [ReportController::class, 'show']);
Route::get('/reports/{id}/comments', [CommentController::class, 'index']);

// Protected routes (require Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/reports', [ReportController::class, 'store']);
    Route::get('/user/reports', [ReportController::class, 'userReports']);

    Route::post('/reports/{id}/confirm', [ConfirmationController::class, 'toggle'])->middleware('throttle:30,1');

    Route::post('/reports/{id}/comments', [CommentController::class, 'store'])->middleware('throttle:10,1');

    // Solo administradores pueden cambiar el estado de un reporte.
    Route::middleware('admin')->patch('/reports/{id}/status', [ReportController::class, 'updateStatus']);

    // Panel de administración: recibir y validar/rechazar reportes.
    Route::middleware('admin')->group(function () {
        // Rutas fijas antes de /admin/reports/{id}/...: no deben confundirse con un id.
        Route::get('/admin/reports', [AdminReportController::class, 'index']);
        Route::get('/admin/reports/summary', [AdminReportController::class, 'summary']);
        Route::get('/admin/reports/export', [AdminReportController::class, 'export']);
        Route::post('/admin/reports/bulk-validation', [AdminReportController::class, 'bulkValidation']);
        Route::get('/admin/zones', [AdminReportController::class, 'zones']);
        Route::patch('/admin/reports/{id}/validation', [AdminReportController::class, 'updateValidation'])->whereNumber('id');
    });
});
