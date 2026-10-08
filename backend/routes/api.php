<?php

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
Route::get('/reports', [ReportController::class, 'index']);
Route::get('/reports/{id}', [ReportController::class, 'show']);
Route::get('/reports/{id}/comments', [CommentController::class, 'index']);

// Protected routes (require Sanctum token)
Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);

    Route::post('/reports', [ReportController::class, 'store']);
    Route::get('/user/reports', [ReportController::class, 'userReports']);

    Route::post('/reports/{id}/confirm', [ConfirmationController::class, 'toggle']);

    Route::post('/reports/{id}/comments', [CommentController::class, 'store']);
});
