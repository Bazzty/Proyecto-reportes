<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// En MySQL la FK reports_user_id_foreign se apoya en el unique (user_id, client_uuid) desde
// 2026_10_30_000001. Con este índice propio la FK deja de depender de él y ese down() ya puede
// eliminar el unique sin el error 1553 ("needed in a foreign key constraint").
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->index('user_id', 'reports_user_id_index');
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropIndex('reports_user_id_index');
        });
    }
};
