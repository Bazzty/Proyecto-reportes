<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

// Moderación anterior de un reporte (quién y cuándo), guardada por el servidor al cambiar entre
// válido y rechazado. "Deshacer" la restaura sin aceptar un moderador o una fecha del cliente.
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->foreignId('previous_validated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('previous_validated_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('reports', function (Blueprint $table) {
            $table->dropConstrainedForeignId('previous_validated_by');
            $table->dropColumn('previous_validated_at');
        });
    }
};
