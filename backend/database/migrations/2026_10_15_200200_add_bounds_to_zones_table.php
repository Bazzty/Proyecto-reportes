<?php

use App\Models\Zone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Caja envolvente de cada zona: permite elegir candidatas con una query indexada
     * y cargar el GeoJSON solo de esas, en vez de cachear todas las zonas.
     */
    public function up(): void
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->double('min_lat')->default(0)->after('area');
            $table->double('max_lat')->default(0)->after('min_lat');
            $table->double('min_lng')->default(0)->after('max_lat');
            $table->double('max_lng')->default(0)->after('min_lng');

            $table->index(['min_lat', 'max_lat', 'min_lng', 'max_lng']);
        });

        // Zonas que ya existían: se calcula su caja a partir del GeoJSON.
        Zone::query()->each(fn (Zone $zone) => $zone->fill($zone->boundingBox())->save());
    }

    public function down(): void
    {
        Schema::table('zones', function (Blueprint $table) {
            $table->dropIndex(['min_lat', 'max_lat', 'min_lng', 'max_lng']);
            $table->dropColumn(['min_lat', 'max_lat', 'min_lng', 'max_lng']);
        });
    }
};
