<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade'); #  El usuario debe estar registrado para poder hacer un reporte y si el usuario se elimina, también se eliminarán sus reportes.
            $table->foreignId('category_id')->constrained()->onDelete('cascade');
            $table->text('description');
            $table->decimal('latitude', 10, 8);
            $table->decimal('longitude', 10, 8);
            $table->string('photo_path');
            $table->enum('status', ['Pendiente', 'En Progreso', 'Resuelto'])->default('Pendiente');
            $table->timestamps();

        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('reports');
    }
};
      