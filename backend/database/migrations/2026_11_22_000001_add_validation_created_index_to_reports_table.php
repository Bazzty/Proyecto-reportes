<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    // Los listados públicos filtran por validation_status y ordenan por created_at DESC.
    // El índice simple de validation_status (2026_10_30_000003) no cubre ese orden.
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->index(['validation_status', 'created_at'], 'reports_validation_status_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex('reports_validation_status_created_at_index');
        });
    }
};
