<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\User;
use App\Models\Zone;
use App\Services\ZoneResolver;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\ZoneSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use RuntimeException;
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

    public function test_assign_command_backfills_zones_without_touching_updated_at()
    {
        $this->seed(ZoneSeeder::class);
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $this->makeReport($user, $category, -41.3198, -72.9833, null);
        $this->makeReport($user, $category, -33.45, -70.65, null);
        Report::query()->update(['updated_at' => '2020-01-01 00:00:00']);

        $this->artisan('zones:assign')->expectsOutput('Reportes actualizados: 1')->assertSuccessful();

        $this->assertSame(1, Report::whereNotNull('zone_id')->count());
        $this->assertSame(
            Zone::where('name', 'Puerto Varas')->value('id'),
            Report::where('latitude', -41.3198)->value('zone_id')
        );
        $this->assertSame(2, Report::where('updated_at', '2020-01-01 00:00:00')->count());
    }

    public function test_assign_command_fails_when_there_are_no_zones()
    {
        $this->artisan('zones:assign')->assertFailed();
    }

    public function test_seeder_removes_zones_missing_from_the_file()
    {
        $this->seed(ZoneSeeder::class);
        Zone::create(['name' => 'Vieja', 'slug' => 'vieja', 'type' => 'comuna', 'boundary' => ['type' => 'Polygon', 'coordinates' => []], 'area' => 1.0]);

        $this->seed(ZoneSeeder::class);

        $this->assertDatabaseMissing('zones', ['slug' => 'vieja']);
        $this->assertSame(7, Zone::count());
    }

    public function test_resolver_assigns_a_border_point_to_exactly_one_adjacent_zone()
    {
        foreach ([['A', 0], ['B', 10]] as [$name, $offset]) {
            Zone::create([
                'name' => $name, 'slug' => strtolower($name), 'type' => 'comuna', 'area' => 1.0,
                'boundary' => ['type' => 'Polygon', 'coordinates' => [
                    [[$offset, 0], [$offset + 10, 0], [$offset + 10, 10], [$offset, 10], [$offset, 0]],
                ]],
            ]);
        }

        // lng = 10 es el borde compartido: debe caer en una sola zona, de forma determinista.
        $zone = app(ZoneResolver::class)->resolve(5.0, 10.0);

        $this->assertNotNull($zone);
        $this->assertSame('B', $zone->name);
    }

    public function test_sector_wins_over_comuna_regardless_of_area()
    {
        $square = fn (int $size) => ['type' => 'Polygon', 'coordinates' => [[[0, 0], [$size, 0], [$size, $size], [0, $size], [0, 0]]]];
        Zone::create(['name' => 'Comuna chica', 'slug' => 'comuna', 'type' => 'comuna', 'area' => 1.0, 'boundary' => $square(10)]);
        Zone::create(['name' => 'Sector grande', 'slug' => 'sector', 'type' => 'sector', 'area' => 5_000_000_000.0, 'boundary' => $square(10)]);

        $this->assertSame('Sector grande', app(ZoneResolver::class)->resolve(5.0, 5.0)->name);
    }

    public function test_resolver_sees_zone_changes_immediately()
    {
        $zone = Zone::create([
            'name' => 'Movil', 'slug' => 'movil', 'type' => 'comuna', 'area' => 1.0,
            'boundary' => ['type' => 'Polygon', 'coordinates' => [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]]],
        ]);
        $resolver = app(ZoneResolver::class);

        $this->assertSame('Movil', $resolver->resolve(5.0, 5.0)->name);

        $zone->update(['boundary' => ['type' => 'Polygon', 'coordinates' => [[[20, 20], [30, 20], [30, 30], [20, 30], [20, 20]]]]]);

        $this->assertNull($resolver->resolve(5.0, 5.0));
        $this->assertSame('Movil', $resolver->resolve(25.0, 25.0)->name);
    }

    public function test_zone_bounding_box_follows_the_boundary()
    {
        $zone = Zone::create([
            'name' => 'Caja', 'slug' => 'caja', 'type' => 'sector', 'area' => 1.0,
            'boundary' => ['type' => 'MultiPolygon', 'coordinates' => [
                [[[1, 2], [3, 2], [3, 4], [1, 4], [1, 2]]],
                [[[10, 20], [12, 20], [12, 22], [10, 22], [10, 20]]],
            ]],
        ])->fresh();

        $this->assertEquals(
            ['min_lat' => 2.0, 'max_lat' => 22.0, 'min_lng' => 1.0, 'max_lng' => 12.0],
            $zone->only(['min_lat', 'max_lat', 'min_lng', 'max_lng'])
        );
    }

    public function test_database_seeder_stores_bounding_boxes_even_without_model_events()
    {
        $this->seed(DatabaseSeeder::class);

        $this->assertSame(0, Zone::where('min_lat', 0)->where('max_lat', 0)->count());
        $this->assertGreaterThan(0, Report::whereNotNull('zone_id')->count());
    }

    public function test_seeder_reassigns_existing_reports_after_zones_are_recreated()
    {
        $this->seed(ZoneSeeder::class);
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $this->makeReport($user, $category, -41.3198, -72.9833, null);

        Zone::query()->delete();
        $this->seed(ZoneSeeder::class);

        $this->assertSame(
            Zone::where('name', 'Puerto Varas')->value('id'),
            Report::value('zone_id')
        );
    }

    public function test_seeder_rejects_features_without_name_or_type()
    {
        $file = tempnam(sys_get_temp_dir(), 'zones');
        file_put_contents($file, json_encode(['features' => [
            ['properties' => ['name' => 'Sin tipo'], 'geometry' => ['type' => 'Polygon', 'coordinates' => []]],
        ]]));

        $seeder = new class($file) extends ZoneSeeder
        {
            public function __construct(private string $file) {}

            protected function path(): string
            {
                return $this->file;
            }
        };

        try {
            $this->expectException(RuntimeException::class);
            $seeder->run();
        } finally {
            unlink($file);
        }
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
