<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use Database\Seeders\DatabaseSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DatabaseSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeds_demo_data_outside_production()
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertGreaterThan(0, Category::count());
        $this->assertTrue(User::where('email', 'bastian@demo.cl')->exists());
    }

    public function test_skips_demo_data_in_production_but_keeps_essentials()
    {
        $this->app['env'] = 'production';

        // En producción db:seed pide confirmación; --force la omite.
        $this->artisan('db:seed', ['--class' => DatabaseSeeder::class, '--force' => true])->assertSuccessful();

        $this->assertGreaterThan(0, Category::count());
        $this->assertSame(0, User::count());
    }
}
