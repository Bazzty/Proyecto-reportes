<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_register()
    {
        $response = $this->postJson('/api/register', [
            'name' => 'Test User',
            'email' => 'test@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email'],
                'token',
            ]);

        $this->assertDatabaseHas('users', [
            'email' => 'test@example.com',
        ]);
    }

    public function test_user_can_login()
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'password123',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'user' => ['id', 'name', 'email'],
                'token',
            ]);
    }

    public function test_login_returns_admin_flag()
    {
        $admin = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);
        $admin->roles()->attach(Role::firstOrCreate(['name' => Role::ADMIN])->id);

        $this->postJson('/api/login', [
            'email' => $admin->email,
            'password' => 'password123',
        ])
            ->assertOk()
            ->assertJsonPath('user.is_admin', true);
    }

    public function test_login_fails_with_wrong_credentials()
    {
        $user = User::factory()->create([
            'password' => Hash::make('password123'),
        ]);

        $response = $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $response->assertUnauthorized();
    }

    public function test_user_can_logout()
    {
        $user = User::factory()->create();
        $token = $user->createToken('auth_token')->plainTextToken;

        $this->assertDatabaseCount('personal_access_tokens', 1);

        $response = $this->withHeader('Authorization', 'Bearer '.$token)
            ->postJson('/api/logout');

        $response->assertOk()
            ->assertJson(['message' => 'Sesión cerrada correctamente.']);

        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_register_rejects_duplicate_email()
    {
        User::factory()->create(['email' => 'dup@example.com']);

        $this->postJson('/api/register', [
            'name' => 'Otro',
            'email' => 'dup@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertUnprocessable()->assertJsonValidationErrors('email');
    }

    public function test_register_rejects_short_or_unconfirmed_password()
    {
        $base = ['name' => 'Test', 'email' => 'new@example.com'];

        $this->postJson('/api/register', $base + [
            'password' => 'short',
            'password_confirmation' => 'short',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');

        $this->postJson('/api/register', $base + [
            'password' => 'password123',
            'password_confirmation' => 'distinta123',
        ])->assertUnprocessable()->assertJsonValidationErrors('password');
    }

    public function test_register_requires_all_fields()
    {
        $this->postJson('/api/register', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'email', 'password']);
    }

    public function test_login_requires_all_fields()
    {
        $this->postJson('/api/login', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_logout_requires_authentication()
    {
        $this->postJson('/api/logout')->assertUnauthorized();
    }

    public function test_login_is_rate_limited_after_five_attempts()
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'nadie@example.com', 'password' => 'incorrecta'])
                ->assertUnauthorized();
        }

        $this->postJson('/api/login', ['email' => 'nadie@example.com', 'password' => 'incorrecta'])
            ->assertStatus(429);
    }

    public function test_login_throttle_is_per_email_not_per_ip()
    {
        for ($i = 0; $i < 5; $i++) {
            $this->postJson('/api/login', ['email' => 'a@example.com', 'password' => 'mala'])->assertUnauthorized();
        }
        $this->postJson('/api/login', ['email' => 'a@example.com', 'password' => 'mala'])->assertStatus(429);

        $this->postJson('/api/login', ['email' => 'b@example.com', 'password' => 'mala'])->assertUnauthorized();
    }

    public function test_register_is_rate_limited_after_ten_attempts()
    {
        for ($i = 0; $i < 10; $i++) {
            $this->postJson('/api/register', [])->assertUnprocessable();
        }

        $this->postJson('/api/register', [])->assertStatus(429);
    }

    public function test_token_expires_after_configured_minutes()
    {
        $token = User::factory()->create()->createToken('auth_token')->plainTextToken;

        $this->withToken($token)->getJson('/api/user/reports')->assertOk();

        $this->travel(31)->days();
        $this->app['auth']->forgetGuards();

        $this->withToken($token)->getJson('/api/user/reports')->assertUnauthorized();
    }

    public function test_registered_user_gets_user_role_only()
    {
        $this->postJson('/api/register', [
            'name' => 'Test User',
            'email' => 'roles@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $user = User::where('email', 'roles@example.com')->first();

        $this->assertTrue($user->hasRole('user'));
        $this->assertFalse($user->isAdmin());
    }

    public function test_admin_factory_state_adds_admin_role()
    {
        $admin = User::factory()->admin()->create();

        $this->assertTrue($admin->hasRole('user'));
        $this->assertTrue($admin->isAdmin());
    }

    public function test_new_user_still_gets_user_role_if_it_was_deleted()
    {
        Role::where('name', 'user')->delete();

        $user = User::factory()->create();

        $this->assertTrue($user->hasRole('user'));
    }
}
