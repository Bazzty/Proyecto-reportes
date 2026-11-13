<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class GrantAdminCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_grants_admin_role_to_existing_user()
    {
        $user = User::factory()->create(['email' => 'ana@example.com']);
        $this->assertFalse($user->isAdmin());

        $this->artisan('user:admin', ['email' => 'ana@example.com'])->assertSuccessful();

        $this->assertTrue($user->fresh()->isAdmin());
    }

    public function test_granting_twice_is_idempotent()
    {
        $user = User::factory()->create(['email' => 'ana@example.com']);

        $this->artisan('user:admin', ['email' => 'ana@example.com'])->assertSuccessful();
        $this->artisan('user:admin', ['email' => 'ana@example.com'])->assertSuccessful();

        $this->assertSame(1, $user->roles()->where('name', Role::ADMIN)->count());
    }

    public function test_revoke_removes_admin_role()
    {
        $user = User::factory()->admin()->create(['email' => 'ana@example.com']);
        $this->assertTrue($user->isAdmin());

        $this->artisan('user:admin', ['email' => 'ana@example.com', '--revoke' => true])->assertSuccessful();

        $this->assertFalse($user->fresh()->isAdmin());
    }

    public function test_fails_for_unknown_email_without_creating_users()
    {
        $before = User::count();

        $this->artisan('user:admin', ['email' => 'no-existe@example.com'])
            ->expectsOutputToContain('No existe ningún usuario')
            ->assertFailed();

        $this->assertSame($before, User::count());
    }
}
