<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SpanishMessagesTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // Un .env local con APP_LOCALE=en no debe volver inestables estas pruebas.
        app()->setLocale('es');
    }

    public function test_default_locale_is_spanish()
    {
        // env() puede venir pisado por el .env local: se comprueban los valores por defecto del código.
        $config = file_get_contents(config_path('app.php'));
        $this->assertStringContainsString("env('APP_LOCALE', 'es')", $config);
        $this->assertStringContainsString("env('APP_FALLBACK_LOCALE', 'es')", $config);
        $example = file_get_contents(base_path('.env.example'));
        $this->assertStringContainsString("APP_LOCALE=es\n", $example);
        $this->assertStringContainsString("APP_FALLBACK_LOCALE=es\n", $example);
    }

    public function test_duplicate_email_error_is_in_spanish()
    {
        User::factory()->create(['email' => 'a@b.cl']);

        $response = $this->postJson('/api/register', [
            'name' => 'Ana', 'email' => 'a@b.cl', 'password' => 'password1', 'password_confirmation' => 'password1',
        ])->assertStatus(422);

        $this->assertSame('El correo ya está registrado.', $response->json('errors.email.0'));
    }

    public function test_required_and_confirmation_errors_are_in_spanish()
    {
        $response = $this->postJson('/api/register', ['password' => 'password1', 'password_confirmation' => 'otra'])
            ->assertStatus(422);

        $this->assertSame('El campo nombre es obligatorio.', $response->json('errors.name.0'));
        $this->assertSame('La confirmación de contraseña no coincide.', $response->json('errors.password.0'));
    }

    public function test_photo_too_large_error_is_in_spanish()
    {
        Sanctum::actingAs(User::factory()->create());
        $category = Category::create(['name' => 'basura']);

        $response = $this->postJson('/api/reports', [
            'description' => 'x', 'latitude' => -41.3, 'longitude' => -72.9, 'category_id' => $category->id,
            'photo' => UploadedFile::fake()->create('big.jpg', 6000, 'image/jpeg'),
        ])->assertStatus(422);

        $this->assertSame('El campo foto no debe superar los 5120 kilobytes.', $response->json('errors.photo.0'));
    }

    public function test_missing_photo_error_is_in_spanish()
    {
        Sanctum::actingAs(User::factory()->create());

        $response = $this->postJson('/api/reports', [])->assertStatus(422);

        $this->assertSame('El campo foto es obligatorio.', $response->json('errors.photo.0'));
        $this->assertSame('El campo categoría es obligatorio.', $response->json('errors.category_id.0'));
    }

    public function test_unauthenticated_message_is_in_spanish()
    {
        $this->getJson('/api/user/reports')
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'No autenticado.']);
    }
}
