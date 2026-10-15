<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use App\Models\Zone;
use App\Services\ZoneResolver;
use Database\Seeders\ZoneSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ZoneHeatmapTest extends TestCase
{
    use RefreshDatabase;

    public function test_seeder_creates_the_expected_zones()
    {
        $this->seed(ZoneSeeder::class);

        $this->assertSame(7, Zone::count());
        $this->assertDatabaseHas('zones', ['name' => 'Puerto Varas', 'type' => 'comuna']);
        $this->assertDatabaseHas('zones', ['name' => 'Ensenada', 'type' => 'sector']);
    }

    public function test_resolver_assigns_a_comuna()
    {
        $this->seed(ZoneSeeder::class);

        $zone = app(ZoneResolver::class)->resolve(-41.3198, -72.9833);

        $this->assertNotNull($zone);
        $this->assertSame('Puerto Varas', $zone->name);
    }

    public function test_resolver_prefers_sector_over_comuna()
    {
        $this->seed(ZoneSeeder::class);

        $zone = app(ZoneResolver::class)->resolve(-41.2030, -72.5700);

        $this->assertNotNull($zone);
        $this->assertSame('Ensenada', $zone->name);
        $this->assertSame('sector', $zone->type);
    }

    public function test_resolver_returns_null_outside_all_zones()
    {
        $this->seed(ZoneSeeder::class);

        $this->assertNull(app(ZoneResolver::class)->resolve(-33.45, -70.65));
    }

    public function test_store_assigns_zone_from_coordinates()
    {
        $this->seed(ZoneSeeder::class);
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(), ['*']);
        $category = Category::create(['name' => 'basura']);

        $response = $this->postJson('/api/reports', $this->validPayload($category, -41.3198, -72.9833));

        $response->assertCreated();
        $this->assertDatabaseHas('reports', [
            'id' => $response->json('id'),
            'zone_id' => Zone::where('name', 'Puerto Varas')->value('id'),
        ]);
    }

    public function test_store_leaves_zone_null_outside_zones()
    {
        $this->seed(ZoneSeeder::class);
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create(), ['*']);
        $category = Category::create(['name' => 'basura']);

        $response = $this->postJson('/api/reports', $this->validPayload($category, -33.45, -70.65));

        $response->assertCreated();
        $this->assertDatabaseHas('reports', ['id' => $response->json('id'), 'zone_id' => null]);
    }

    public function test_heatmap_groups_by_zone_and_buckets_without_zone()
    {
        $this->seed(ZoneSeeder::class);
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $puertoVaras = Zone::where('name', 'Puerto Varas')->value('id');

        $this->makeReport($user, $category, -41.3198, -72.9833, $puertoVaras);
        $this->makeReport($user, $category, -41.3175, -72.9860, $puertoVaras);
        $this->makeReport($user, $category, -33.45, -70.65, null);

        $response = $this->getJson('/api/reports/heatmap')->assertOk()->assertJsonCount(2);

        $data = collect($response->json());
        $comuna = $data->firstWhere('zone.name', 'Puerto Varas');
        $sinZona = $data->firstWhere('zone.name', 'Sin zona');

        $this->assertSame(2, $comuna['count']);
        $this->assertSame(1, $sinZona['count']);
        $this->assertNull($sinZona['zone']['id']);
        $this->assertArrayHasKey('latitude', $comuna);
        $this->assertArrayHasKey('longitude', $comuna);
    }

    private function makeReport(User $user, Category $category, float $lat, float $lng, ?int $zoneId): void
    {
        Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'zone_id' => $zoneId,
            'description' => 'Reporte de prueba',
            'latitude' => $lat,
            'longitude' => $lng,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
        ]);
    }

    private function validPayload(Category $category, float $lat, float $lng): array
    {
        return [
            'description' => 'Basura en la vereda',
            'latitude' => $lat,
            'longitude' => $lng,
            'category_id' => $category->id,
            'photo' => UploadedFile::fake()->create('photo.jpg', 100, 'image/jpeg'),
        ];
    }
}
