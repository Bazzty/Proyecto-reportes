<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->timestamps();
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('role_id')->constrained()->onDelete('cascade');
            $table->timestamps();

            $table->primary(['user_id', 'role_id']);
        });

        // Los roles son datos de referencia: deben existir en todo entorno.
        $now = now();
        DB::table('roles')->insert([
            ['name' => 'user', 'created_at' => $now, 'updated_at' => $now],
            ['name' => 'admin', 'created_at' => $now, 'updated_at' => $now],
        ]);

        // Los usuarios ya existentes quedan con el rol "user".
        $userRoleId = DB::table('roles')->where('name', 'user')->value('id');
        DB::table('role_user')->insertUsing(
            ['user_id', 'role_id', 'created_at', 'updated_at'],
            DB::table('users')->selectRaw('id, ?, ?, ?', [$userRoleId, $now, $now])
        );
    }

    public function down(): void
    {
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('roles');
    }
};
