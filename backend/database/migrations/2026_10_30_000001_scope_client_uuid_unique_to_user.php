<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropUnique(['client_uuid']);
            $table->unique(['user_id', 'client_uuid']);
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            // En MySQL la FK de user_id se apoya en este unique: sin un índice propio no se puede borrar.
            $table->index('user_id');
            $table->dropUnique(['user_id', 'client_uuid']);
            $table->unique(['client_uuid']);
        });
    }
};
