<?php

use Illuminate\Support\Facades\Route;

// Public routes
Route::post('/register', [App\Http\Controllers\AuthController::class, 'register']);
Route::post('/login',    [App\Http\Controllers\AuthController::class, 'login']);

Route::get('/categories',             [App\Http\Controllers\CategoryController::class, 'index']);
Route::get('/reports/heatmap',        [App\Http\Controllers\ReportController::class, 'heatmap']);
Route::get('/reports',                [App\Http\Controllers\ReportController::class, 'index']);
Route::get('/reports/{id}',           [App\Http\Controllers\ReportController::class, 'show']);
Route::get('/reports/{id}/comments',  [App\Http\Controllers\CommentController::class, 'index']);

// Protected routes (require Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [App\Http\Controllers\AuthController::class, 'logout']);

    Route::post('/reports',                    [App\Http\Controllers\ReportController::class, 'store']);
    Route::get('/user/reports',                [App\Http\Controllers\ReportController::class, 'userReports']);

    Route::post('/reports/{id}/confirm',       [App\Http\Controllers\ConfirmationController::class, 'toggle']);

    Route::post('/reports/{id}/comments',      [App\Http\Controllers\CommentController::class, 'store']);
});
