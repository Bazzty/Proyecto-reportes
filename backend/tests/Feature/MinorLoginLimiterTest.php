<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class MinorLoginLimiterTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        RateLimiter::clear('login');
    }

    public function test_login_with_array_email_is_a_validation_error_not_a_500(): void
    {
        $this->postJson('/api/login', ['email' => ['a'], 'password' => 'x'])
            ->assertStatus(422);
    }

    public function test_login_is_limited_per_ip_even_with_different_emails(): void
    {
        for ($i = 1; $i <= 30; $i++) {
            $this->assertNotSame(429, $this->postJson('/api/login', [
                'email' => "u{$i}@example.com", 'password' => 'x',
            ])->status(), "intento {$i}");
        }

        $this->postJson('/api/login', ['email' => 'u31@example.com', 'password' => 'x'])
            ->assertStatus(429);
    }
}
