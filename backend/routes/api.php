<?php

use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [App\Http\Controllers\AuthController::class, 'register']);
Route::post('/login',    [App\Http\Controllers\AuthController::class, 'login']);

// Protected routes (require Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [App\Http\Controllers\AuthController::class, 'logout']);

    Route::get('/reports',           [App\Http\Controllers\ReportController::class, 'index']);
    Route::post('/reports',          [App\Http\Controllers\ReportController::class, 'store']);
    Route::get('/reports/heatmap',   [App\Http\Controllers\ReportController::class, 'heatmap']);
    Route::get('/reports/{id}',      [App\Http\Controllers\ReportController::class, 'show']);

    Route::get('/user/reports',      [App\Http\Controllers\ReportController::class, 'userReports']);
});
