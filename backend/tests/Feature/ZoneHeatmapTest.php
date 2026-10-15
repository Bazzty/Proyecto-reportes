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

    public function test_heatmap_returns_individual_points_with_zone()
    {
        $this->seed(ZoneSeeder::class);
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $puertoVaras = Zone::where('name', 'Puerto Varas')->value('id');

        $this->makeReport($user, $category, -41.3198, -72.9833, $puertoVaras);
        $this->makeReport($user, $category, -41.3175, -72.9860, $puertoVaras);
        $this->makeReport($user, $category, -33.45, -70.65, null);

        // Un punto por reporte (no agregado), así no se pierde la densidad.
        $response = $this->getJson('/api/reports/heatmap')->assertOk()->assertJsonCount(3);

        $data = collect($response->json());
        $this->assertTrue($data->every(fn ($p) => isset($p['latitude'], $p['longitude'])));

        $zoned = $data->filter(fn ($p) => ($p['zone']['name'] ?? null) === 'Puerto Varas');
        $this->assertCount(2, $zoned);

        $unzoned = $data->first(fn ($p) => $p['zone'] === null);
        $this->assertNotNull($unzoned);
        $this->assertSame(-33.45, $unzoned['latitude']);
    }

    public function test_resolver_matches_multipolygon()
    {
        Zone::create([
            'name' => 'Multi', 'slug' => 'multi', 'type' => 'sector', 'area' => 1.0,
            'boundary' => ['type' => 'MultiPolygon', 'coordinates' => [
                [[[0, 0], [0, 1], [1, 1], [1, 0], [0, 0]]],
                [[[10, 10], [10, 11], [11, 11], [11, 10], [10, 10]]],
            ]],
        ]);

        $resolver = app(ZoneResolver::class);

        $this->assertNotNull($resolver->resolve(0.5, 0.5));
        $this->assertNotNull($resolver->resolve(10.5, 10.5));
        $this->assertNull($resolver->resolve(5.0, 5.0));
    }

    public function test_resolver_respects_polygon_holes()
    {
        Zone::create([
            'name' => 'Hole', 'slug' => 'hole', 'type' => 'comuna', 'area' => 1.0,
            'boundary' => ['type' => 'Polygon', 'coordinates' => [
                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
                [[4, 4], [6, 4], [6, 6], [4, 6], [4, 4]],
            ]],
        ]);

        $resolver = app(ZoneResolver::class);

        $this->assertNotNull($resolver->resolve(2.0, 2.0));
        $this->assertNull($resolver->resolve(5.0, 5.0));
    }

    public function test_resolver_handles_points_near_the_edge()
    {
        Zone::create([
            'name' => 'Edge', 'slug' => 'edge', 'type' => 'comuna', 'area' => 1.0,
            'boundary' => ['type' => 'Polygon', 'coordinates' => [
                [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
            ]],
        ]);

        $resolver = app(ZoneResolver::class);

        $this->assertNotNull($resolver->resolve(0.0001, 0.0001));
        $this->assertNull($resolver->resolve(-0.5, -0.5));
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
