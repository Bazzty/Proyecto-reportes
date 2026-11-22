<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// La API y la app aceptan motivos de hasta 500 caracteres, pero la columna era string(255):
// en MySQL un motivo largo daba 500 (Data too long).
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->text('rejection_reason')->nullable()->change();
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->string('rejection_reason')->nullable()->change();
        });
    }
};
