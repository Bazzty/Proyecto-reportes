<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Comment;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ListLimitsTest extends TestCase
{
    use RefreshDatabase;

    private function makeReport(User $user, string $validation = 'valido'): Report
    {
        return Report::create([
            'user_id' => $user->id,
            'category_id' => Category::firstOrCreate(['name' => 'basura'])->id,
            'description' => 'Reporte',
            'latitude' => -41.32,
            'longitude' => -72.98,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
            'validation_status' => $validation,
        ]);
    }

    /** @return array<int, string> consultas ejecutadas, sin comillas de identificadores */
    private function queriesDuring(callable $callback): array
    {
        DB::flushQueryLog();
        DB::enableQueryLog();
        $callback();

        return array_map(fn ($q) => str_replace(['`', '"'], '', $q['query']), DB::getQueryLog());
    }

    public function test_report_listings_only_load_id_and_name_of_the_user()
    {
        $user = User::factory()->create();
        $this->makeReport($user);
        Sanctum::actingAs($user);

        foreach (['/api/reports', '/api/user/reports'] as $url) {
            $queries = $this->queriesDuring(fn () => $this->getJson($url)->assertOk()->assertJsonCount(1));

            $userQueries = array_values(array_filter($queries, fn ($q) => str_contains($q, 'from users')));
            $this->assertNotEmpty($userQueries, $url);
            foreach ($userQueries as $q) {
                $this->assertStringStartsWith('select id, name from users', $q, $url);
            }
        }
    }

    public function test_report_listings_have_a_hard_cap()
    {
        $user = User::factory()->create();
        $this->makeReport($user);
        Sanctum::actingAs($user);

        $caps = ['/api/reports' => 2000, '/api/user/reports' => 500, '/api/reports/heatmap' => 5000];
        foreach ($caps as $url => $cap) {
            $queries = $this->queriesDuring(fn () => $this->getJson($url)->assertOk()->assertJsonCount(1));
            $this->assertTrue(
                collect($queries)->contains(fn ($q) => str_contains($q, 'from reports') && str_contains($q, "limit {$cap}")),
                "{$url} debe limitar a {$cap} filas."
            );
        }
    }

    public function test_comments_are_capped_to_the_200_most_recent_in_the_same_order()
    {
        $user = User::factory()->create();
        $report = $this->makeReport($user);

        $now = now();
        $rows = [];
        for ($i = 1; $i <= 201; $i++) {
            $rows[] = [
                'user_id' => $user->id, 'report_id' => $report->id, 'body' => "c{$i}",
                'created_at' => $now->copy()->addSeconds($i), 'updated_at' => $now->copy()->addSeconds($i),
            ];
        }
        Comment::insert($rows);

        $bodies = collect($this->getJson("/api/reports/{$report->id}/comments")->assertOk()->json())->pluck('body');

        $this->assertCount(200, $bodies);
        $this->assertSame('c201', $bodies->first());
        $this->assertSame('c2', $bodies->last());
        $this->assertNotContains('c1', $bodies->all());
    }

    public function test_reports_has_composite_index_on_validation_status_and_created_at()
    {
        $indexes = collect(Schema::getIndexes('reports'));

        $this->assertTrue($indexes->contains(fn ($i) => $i['columns'] === ['validation_status', 'created_at']));
    }
}
