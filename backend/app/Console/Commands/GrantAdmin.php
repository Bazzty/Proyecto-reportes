<?php

namespace App\Console\Commands;

use App\Models\Role;
use App\Models\User;
use Illuminate\Console\Command;

class GrantAdmin extends Command
{
    protected $signature = 'user:admin {email : Correo del usuario ya registrado} {--revoke : Quita el rol admin en vez de otorgarlo}';

    protected $description = 'Otorga (o con --revoke quita) el rol admin a un usuario ya registrado';

    public function handle(): int
    {
        $email = (string) $this->argument('email');
        $user = User::where('email', $email)->first();

        // Nunca crea usuarios ni toca contraseñas: solo opera sobre cuentas existentes.
        if (! $user) {
            $this->error("No existe ningún usuario con el correo {$email}.");

            return self::FAILURE;
        }

        $adminRole = Role::firstOrCreate(['name' => Role::ADMIN]);

        if ($this->option('revoke')) {
            $user->roles()->detach($adminRole->id);
            $this->info("Rol admin removido de {$email}.");

            return self::SUCCESS;
        }

        $user->roles()->syncWithoutDetaching([$adminRole->id]);
        $this->info("{$email} ahora es administrador.");

        return self::SUCCESS;
    }
}
