<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Confirmation;
use App\Models\Report;
use App\Models\User;
use App\Models\Zone;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminPanelTest extends TestCase
{
    use RefreshDatabase;

    private Category $category;

    protected function setUp(): void
    {
        parent::setUp();
        $this->category = Category::create(['name' => 'basura']);
    }

    private function actAsAdmin(): User
    {
        $admin = User::factory()->admin()->create();
        Sanctum::actingAs($admin, ['*']);

        return $admin;
    }

    private function makeZone(string $name): Zone
    {
        return Zone::create([
            'name' => $name,
            'slug' => str($name)->slug()->toString(),
            'type' => 'comuna',
            'boundary' => ['type' => 'Polygon', 'coordinates' => [[[0, 0], [1, 0], [1, 1], [0, 0]]]],
        ]);
    }

    private function makeReport(array $overrides = []): Report
    {
        return Report::create(array_merge([
            'user_id' => User::factory()->create()->id,
            'category_id' => $this->category->id,
            'description' => 'Reporte de prueba',
            'latitude' => -41.32,
            'longitude' => -72.98,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
            'validation_status' => 'pendiente',
        ], $overrides));
    }

    private function csvLines(string $content): array
    {
        $rows = [];
        $stream = fopen('php://memory', 'r+');
        fwrite($stream, substr($content, 3));
        rewind($stream);
        while (($row = fgetcsv($stream, 0, ',', '"', '')) !== false) {
            $rows[] = $row;
        }

        return $rows;
    }

    // ---- Acceso (todos los endpoints nuevos) ----

    public function test_new_endpoints_require_authentication_and_admin()
    {
        $calls = [
            ['getJson', '/api/admin/zones'],
            ['getJson', '/api/admin/reports/summary'],
            ['getJson', '/api/admin/reports/export'],
            ['postJson', '/api/admin/reports/bulk-validation'],
        ];

        foreach ($calls as [$method, $url]) {
            $this->$method($url)->assertUnauthorized();
        }

        Sanctum::actingAs(User::factory()->create(), ['*']);
        foreach ($calls as [$method, $url]) {
            $this->$method($url)->assertForbidden();
        }
    }

    // ---- Listado: búsqueda, orden, campos nuevos ----

    public function test_search_matches_description_author_and_zone()
    {
        $this->actAsAdmin();
        $zone = $this->makeZone('Puerto Montt');
        $byDesc = $this->makeReport(['description' => 'Microbasural en la costanera']);
        $byAuthor = $this->makeReport(['user_id' => User::factory()->create(['name' => 'Zenobia Quiroga'])->id]);
        $byZone = $this->makeReport(['zone_id' => $zone->id]);
        $this->makeReport(['description' => 'Otro asunto']);

        $this->getJson('/api/admin/reports?search=costanera')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $byDesc->id);
        $this->getJson('/api/admin/reports?search=zenobia')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $byAuthor->id);
        $this->getJson('/api/admin/reports?search=puerto%20mon')->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $byZone->id);
    }

    public function test_search_is_trimmed_and_blank_means_no_filter()
    {
        $this->actAsAdmin();
        $this->makeReport(['description' => 'alfa']);
        $this->makeReport(['description' => 'beta']);

        $this->getJson('/api/admin/reports?search=%20%20alfa%20')->assertJsonPath('meta.total', 1);
        $this->getJson('/api/admin/reports?search=%20%20')->assertJsonPath('meta.total', 2);
    }

    public function test_search_treats_wildcards_as_literal_text()
    {
        $this->actAsAdmin();
        $percent = $this->makeReport(['description' => 'Avance 100% listo']);
        $underscore = $this->makeReport(['description' => 'archivo_final']);
        $this->makeReport(['description' => 'Avance 100 listo']);
        $this->makeReport(['description' => 'archivoXfinal']);
        $bang = $this->makeReport(['description' => 'Atención! urgente']);
        $backslash = $this->makeReport(['description' => 'ruta C:\\temp']);

        $this->getJson('/api/admin/reports?search='.urlencode('%'))->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $percent->id);
        $this->getJson('/api/admin/reports?search='.urlencode('_'))->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $underscore->id);
        $this->getJson('/api/admin/reports?search='.urlencode('n! u'))->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $bang->id);
        $this->getJson('/api/admin/reports?search='.urlencode('\\'))->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $backslash->id);
    }

    public function test_search_validates_length_and_applies_to_counts()
    {
        $this->actAsAdmin();
        $this->makeReport(['description' => 'alfa']);
        $this->makeReport(['description' => 'alfa', 'validation_status' => 'valido']);
        $this->makeReport(['description' => 'beta']);

        $this->getJson('/api/admin/reports?search='.str_repeat('a', 101))->assertUnprocessable()->assertJsonValidationErrors('search');

        $this->getJson('/api/admin/reports?search=alfa&validation_status=valido')
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('meta.counts', ['pendiente' => 1, 'valido' => 1, 'rechazado' => 0, 'total' => 2]);
    }

    public function test_sort_by_confirmations_then_recent_and_rejects_unknown_values()
    {
        $this->actAsAdmin();
        $old = $this->makeReport();
        $popular = $this->makeReport();
        $newest = $this->makeReport();
        foreach ([2, 3] as $n) {
            for ($i = 0; $i < $n; $i++) {
                Confirmation::create(['user_id' => User::factory()->create()->id, 'report_id' => $n === 3 ? $popular->id : $old->id]);
            }
        }

        $this->getJson('/api/admin/reports?sort=confirmaciones')
            ->assertOk()
            ->assertJsonPath('data.*.id', [$popular->id, $old->id, $newest->id]);

        $this->getJson('/api/admin/reports')->assertJsonPath('data.*.id', [$newest->id, $popular->id, $old->id]);
        $this->getJson('/api/admin/reports?sort=recientes')->assertJsonPath('data.0.id', $newest->id);
        $this->getJson('/api/admin/reports?sort=azar')->assertUnprocessable()->assertJsonValidationErrors('sort');
    }

    public function test_listing_includes_status_updated_by_and_auto_validated()
    {
        $admin = $this->actAsAdmin();
        $editor = User::factory()->create(['name' => 'Editora']);
        $moderated = $this->makeReport(['validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => now(),
            'status' => 'Resuelto', 'status_updated_by' => $editor->id, 'status_updated_at' => now()]);
        $auto = $this->makeReport(['user_id' => $admin->id, 'validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => now()]);
        $pending = $this->makeReport();

        $data = collect($this->getJson('/api/admin/reports')->assertOk()->json('data'))->keyBy('id');

        $this->assertSame(['id' => $editor->id, 'name' => 'Editora'], $data[$moderated->id]['status_updated_by']);
        $this->assertNotNull($data[$moderated->id]['status_updated_at']);
        $this->assertFalse($data[$moderated->id]['auto_validated']);
        $this->assertTrue($data[$auto->id]['auto_validated']);
        $this->assertNull($data[$auto->id]['status_updated_by']);
        $this->assertNull($data[$auto->id]['status_updated_at']);
        $this->assertFalse($data[$pending->id]['auto_validated']);
    }

    // ---- Zonas ----

    public function test_zones_are_listed_by_name()
    {
        $this->actAsAdmin();
        $b = $this->makeZone('Puerto Varas');
        $a = $this->makeZone('Frutillar');
        $c = $this->makeZone('Osorno');

        $this->getJson('/api/admin/zones')
            ->assertOk()
            ->assertExactJson([
                ['id' => $a->id, 'name' => 'Frutillar'],
                ['id' => $c->id, 'name' => 'Osorno'],
                ['id' => $b->id, 'name' => 'Puerto Varas'],
            ]);
    }

    public function test_zones_empty()
    {
        $this->actAsAdmin();

        $this->getJson('/api/admin/zones')->assertOk()->assertExactJson([]);
    }

    // ---- Resumen ----

    public function test_summary_with_no_data()
    {
        $this->actAsAdmin();

        $this->getJson('/api/admin/reports/summary')
            ->assertOk()
            ->assertExactJson([
                'total' => 0, 'pending' => 0, 'new_this_week' => 0, 'avg_validation_hours' => null, 'top_zone' => null,
            ]);
    }

    public function test_summary_with_data_counts_own_reports_in_the_average()
    {
        $admin = $this->actAsAdmin();
        $big = $this->makeZone('Puerto Montt');
        $small = $this->makeZone('Frutillar');

        $created = now()->subDays(10);
        // 2 h, 5 h y 9 h -> promedio 5.3 (el reporte del propio admin también pasó por la cola).
        $this->makeReport(['zone_id' => $big->id, 'validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => $created->copy()->addHours(2)])
            ->forceFill(['created_at' => $created])->save();
        $this->makeReport(['zone_id' => $big->id, 'validation_status' => 'rechazado', 'rejection_reason' => 'x', 'validated_by' => $admin->id, 'validated_at' => $created->copy()->addHours(5)])
            ->forceFill(['created_at' => $created])->save();
        $this->makeReport(['user_id' => $admin->id, 'zone_id' => $small->id, 'validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => $created->copy()->addHours(9)])
            ->forceFill(['created_at' => $created])->save();
        $this->makeReport(['zone_id' => $small->id]);
        // Rechazado: no cuenta para top_zone.
        $this->makeReport(['zone_id' => $small->id, 'validation_status' => 'rechazado', 'rejection_reason' => 'x']);

        $response = $this->getJson('/api/admin/reports/summary')->assertOk();
        $response->assertJsonPath('total', 5)
            ->assertJsonPath('pending', 1)
            ->assertJsonPath('new_this_week', 2)
            ->assertJsonPath('avg_validation_hours', 5.3);
        // small tiene 2 no rechazados (el del admin + pendiente); big solo 1 y el rechazado no cuenta.
        $response->assertJsonPath('top_zone', ['id' => $small->id, 'name' => 'Frutillar', 'count' => 2]);
    }

    public function test_summary_excludes_legacy_auto_validation_at_creation()
    {
        $admin = $this->actAsAdmin();
        $created = now()->subDays(3);
        $this->makeReport(['validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => $created->copy()->addHours(4)])
            ->forceFill(['created_at' => $created])->save();
        // Autovalidado al crearse (versiones anteriores): no fue una espera en la cola.
        $this->makeReport(['user_id' => $admin->id, 'validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => $created])
            ->forceFill(['created_at' => $created])->save();

        $this->getJson('/api/admin/reports/summary')->assertOk()
            ->assertJsonPath('avg_validation_hours', 4);
    }

    public function test_summary_top_zone_counts_non_rejected_and_breaks_ties_by_id()
    {
        $this->actAsAdmin();
        $first = $this->makeZone('Alfa');
        $second = $this->makeZone('Beta');
        $this->makeReport(['zone_id' => $second->id]);
        $this->makeReport(['zone_id' => $second->id]);
        $this->makeReport(['zone_id' => $second->id, 'validation_status' => 'rechazado', 'rejection_reason' => 'x']);
        $this->makeReport(['zone_id' => $first->id]);
        $this->makeReport(['zone_id' => $first->id]);

        $this->getJson('/api/admin/reports/summary')
            ->assertJsonPath('top_zone', ['id' => $first->id, 'name' => 'Alfa', 'count' => 2]);
    }

    // ---- Deshacer validación ----

    public function test_undo_validation_clears_fields_and_resets_status()
    {
        $admin = $this->actAsAdmin();
        $report = $this->makeReport([
            'validation_status' => 'rechazado', 'rejection_reason' => 'Motivo', 'validated_by' => $admin->id, 'validated_at' => now(),
            'status' => 'En Progreso', 'status_updated_by' => $admin->id, 'status_updated_at' => now(),
        ]);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", [
            'validation_status' => 'pendiente',
            'expected_validation_status' => 'rechazado',
        ])->assertOk()
            ->assertJsonPath('validation_status', 'pendiente')
            ->assertJsonPath('status', 'Pendiente')
            ->assertJsonPath('validated_by', null)
            ->assertJsonPath('status_updated_by', null)
            ->assertJsonPath('rejection_reason', null);

        $fresh = $report->fresh();
        $this->assertNull($fresh->validated_by);
        $this->assertNull($fresh->validated_at);
        $this->assertNull($fresh->rejection_reason);
        $this->assertNull($fresh->status_updated_by);
        $this->assertNull($fresh->status_updated_at);
        $this->assertSame('Pendiente', $fresh->status);
    }

    public function test_undo_validation_gives_409_with_stale_expected_status()
    {
        $admin = $this->actAsAdmin();
        $report = $this->makeReport(['validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => now()]);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", [
            'validation_status' => 'pendiente',
            'expected_validation_status' => 'rechazado',
        ])->assertStatus(409);

        $this->assertSame('valido', $report->fresh()->validation_status);
    }

    public function test_undo_validation_gives_409_if_status_already_advanced()
    {
        $admin = $this->actAsAdmin();
        $editor = User::factory()->create();
        $report = $this->makeReport([
            'validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => now(),
            'status' => 'Resuelto', 'status_updated_by' => $editor->id, 'status_updated_at' => now(),
        ]);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", [
            'validation_status' => 'pendiente',
            'expected_validation_status' => 'valido',
        ])->assertStatus(409);

        $fresh = $report->fresh();
        $this->assertSame('valido', $fresh->validation_status);
        $this->assertSame('Resuelto', $fresh->status);
        $this->assertSame($editor->id, $fresh->status_updated_by);
    }

    public function test_undo_reject_restores_the_original_validator_and_date()
    {
        $original = User::factory()->admin()->create();
        $admin = $this->actAsAdmin();
        $validatedAt = now()->subDays(5)->startOfSecond();
        $report = $this->makeReport(['validation_status' => 'valido', 'validated_by' => $original->id, 'validated_at' => $validatedAt]);
        $url = "/api/admin/reports/{$report->id}/validation";

        // Rechazar un reporte ya validado: el servidor guarda quién lo había validado.
        $this->patchJson($url, [
            'validation_status' => 'rechazado',
            'expected_validation_status' => 'valido',
            'rejection_reason' => 'Duplicado',
        ])->assertOk()->assertJsonPath('validated_by.id', $admin->id);

        // Deshacer: restaura esa moderación sin que el cliente diga quién ni cuándo.
        $this->patchJson($url, [
            'validation_status' => 'valido',
            'expected_validation_status' => 'rechazado',
            'restore_previous' => true,
        ])->assertOk()->assertJsonPath('validated_by.id', $original->id);

        $fresh = $report->fresh();
        $this->assertSame('valido', $fresh->validation_status);
        $this->assertSame($original->id, $fresh->validated_by);
        $this->assertTrue($fresh->validated_at->equalTo($validatedAt));
        $this->assertNull($fresh->rejection_reason);
        $this->assertNull($fresh->previous_validated_by);
    }

    public function test_undo_restores_the_date_when_the_previous_moderator_was_deleted()
    {
        $original = User::factory()->admin()->create();
        $admin = $this->actAsAdmin();
        $validatedAt = now()->subDays(2)->startOfSecond();
        $report = $this->makeReport(['validation_status' => 'rechazado', 'rejection_reason' => 'x', 'validated_by' => $original->id, 'validated_at' => $validatedAt]);
        $url = "/api/admin/reports/{$report->id}/validation";

        $this->patchJson($url, ['validation_status' => 'valido', 'expected_validation_status' => 'rechazado'])->assertOk();
        $original->delete();

        $this->patchJson($url, [
            'validation_status' => 'rechazado',
            'expected_validation_status' => 'valido',
            'rejection_reason' => 'x',
            'restore_previous' => true,
        ])->assertOk();

        $fresh = $report->fresh();
        $this->assertSame('rechazado', $fresh->validation_status);
        $this->assertNull($fresh->validated_by);
        $this->assertTrue($fresh->validated_at->equalTo($validatedAt));
        $this->assertNull($fresh->previous_validated_at);
    }

    public function test_rejecting_again_updates_the_reason()
    {
        $admin = $this->actAsAdmin();
        $report = $this->makeReport(['validation_status' => 'rechazado', 'rejection_reason' => 'Duplicao', 'validated_by' => $admin->id, 'validated_at' => now()]);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", [
            'validation_status' => 'rechazado',
            'expected_validation_status' => 'rechazado',
            'rejection_reason' => 'Duplicado',
        ])->assertOk()->assertJsonPath('rejection_reason', 'Duplicado');

        $this->assertSame('Duplicado', $report->fresh()->rejection_reason);
    }

    public function test_restore_ignores_a_moderator_or_date_sent_by_the_client()
    {
        $other = User::factory()->admin()->create();
        $admin = $this->actAsAdmin();
        $report = $this->makeReport(['validation_status' => 'rechazado', 'rejection_reason' => 'x', 'validated_by' => $admin->id, 'validated_at' => now()]);
        $url = "/api/admin/reports/{$report->id}/validation";

        // Sin moderación anterior guardada: los campos antiguos del cliente se ignoran y queda quien actúa.
        $this->patchJson($url, [
            'validation_status' => 'valido',
            'expected_validation_status' => 'rechazado',
            'restore_previous' => true,
            'restore_validated_by' => $other->id,
            'restore_validated_at' => now()->subYear()->toISOString(),
        ])->assertOk()->assertJsonPath('validated_by.id', $admin->id);

        $this->assertTrue($report->fresh()->validated_at->isToday());

        $this->patchJson($url, ['validation_status' => 'pendiente', 'expected_validation_status' => 'valido', 'restore_previous' => true])
            ->assertUnprocessable()->assertJsonValidationErrors('restore_previous');
        $this->assertSame('valido', $report->fresh()->validation_status);
    }

    public function test_undo_validation_does_not_require_reason_and_requires_expected()
    {
        $admin = $this->actAsAdmin();
        $report = $this->makeReport(['validation_status' => 'valido', 'validated_by' => $admin->id, 'validated_at' => now()]);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", ['validation_status' => 'pendiente'])
            ->assertUnprocessable()->assertJsonValidationErrors('expected_validation_status');
        $this->patchJson("/api/admin/reports/{$report->id}/validation", ['validation_status' => 'pendiente', 'expected_validation_status' => 'valido'])
            ->assertOk();
    }

    // ---- Validación masiva ----

    public function test_bulk_validates_pending_and_skips_the_rest()
    {
        $admin = $this->actAsAdmin();
        $a = $this->makeReport();
        $b = $this->makeReport();
        $done = $this->makeReport(['validation_status' => 'rechazado', 'rejection_reason' => 'x']);

        $this->postJson('/api/admin/reports/bulk-validation', [
            'ids' => [$a->id, $done->id, $b->id],
            'validation_status' => 'valido',
        ])->assertOk()
            ->assertJsonPath('updated', [$a->id, $b->id])
            ->assertJsonPath('skipped', [$done->id])
            ->assertJsonPath('validated_by', ['id' => $admin->id, 'name' => $admin->name])
            ->assertJsonPath('validated_at', fn ($at) => $at === $a->fresh()->validated_at->toISOString());

        $this->assertDatabaseHas('reports', ['id' => $a->id, 'validation_status' => 'valido', 'validated_by' => $admin->id]);
        $this->assertNotNull($a->fresh()->validated_at);
        $this->assertSame('rechazado', $done->fresh()->validation_status);
        $this->assertSame('x', $done->fresh()->rejection_reason);
    }

    public function test_bulk_reject_requires_reason_and_stores_it()
    {
        $this->actAsAdmin();
        $a = $this->makeReport();

        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => [$a->id], 'validation_status' => 'rechazado'])
            ->assertUnprocessable()->assertJsonValidationErrors('rejection_reason');
        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => [$a->id], 'validation_status' => 'rechazado', 'rejection_reason' => str_repeat('a', 501)])
            ->assertUnprocessable()->assertJsonValidationErrors('rejection_reason');

        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => [$a->id], 'validation_status' => 'rechazado', 'rejection_reason' => 'Spam'])
            ->assertOk()->assertJsonPath('updated', [$a->id]);
        $this->assertDatabaseHas('reports', ['id' => $a->id, 'validation_status' => 'rechazado', 'rejection_reason' => 'Spam']);
    }

    public function test_bulk_validation_input_errors()
    {
        $this->actAsAdmin();
        $a = $this->makeReport();

        $this->postJson('/api/admin/reports/bulk-validation', ['validation_status' => 'valido'])->assertUnprocessable()->assertJsonValidationErrors('ids');
        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => [], 'validation_status' => 'valido'])->assertUnprocessable()->assertJsonValidationErrors('ids');
        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => [$a->id], 'validation_status' => 'pendiente'])->assertUnprocessable()->assertJsonValidationErrors('validation_status');
        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => [$a->id, 99999], 'validation_status' => 'valido'])->assertUnprocessable()->assertJsonValidationErrors('ids');
        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => [$a->id, $a->id], 'validation_status' => 'valido'])->assertUnprocessable();
        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => ['x'], 'validation_status' => 'valido'])->assertUnprocessable();

        $this->assertSame('pendiente', $a->fresh()->validation_status);
    }

    public function test_bulk_accepts_50_ids_but_not_51()
    {
        $this->actAsAdmin();
        $ids = collect(range(1, 51))->map(fn () => $this->makeReport()->id);

        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => $ids->all(), 'validation_status' => 'valido'])
            ->assertUnprocessable()->assertJsonValidationErrors('ids');
        $this->assertSame(0, Report::where('validation_status', 'valido')->count());

        $this->postJson('/api/admin/reports/bulk-validation', ['ids' => $ids->take(50)->all(), 'validation_status' => 'valido'])
            ->assertOk()->assertJsonCount(50, 'updated')->assertJsonCount(0, 'skipped');
    }

    // ---- Paginación por offset ----

    public function test_offset_paging_does_not_skip_reports_after_moderating()
    {
        $this->actAsAdmin();
        $reports = collect(range(1, 25))->map(fn () => $this->makeReport());

        $first = $this->getJson('/api/admin/reports?validation_status=pendiente&offset=0')->assertOk();
        $first->assertJsonCount(20, 'data')->assertJsonPath('meta.total', 25)->assertJsonPath('meta.offset', 0);
        $firstIds = collect($first->json('data'))->pluck('id');

        // Se moderan 5 de la primera página: la app los saca y le quedan 15 filas.
        Report::whereIn('id', $firstIds->take(5))->update(['validation_status' => 'valido']);

        $next = $this->getJson('/api/admin/reports?validation_status=pendiente&offset=15')->assertOk();
        $nextIds = collect($next->json('data'))->pluck('id');

        // Las 15 que ya tiene + las 5 nuevas = los 20 pendientes, sin huecos ni repetidos.
        $this->assertEqualsCanonicalizing(
            Report::where('validation_status', 'pendiente')->pluck('id')->all(),
            $firstIds->slice(5)->merge($nextIds)->all()
        );
        $this->assertCount(25, $reports);
    }

    public function test_offset_must_be_a_non_negative_integer()
    {
        $this->actAsAdmin();

        $this->getJson('/api/admin/reports?offset=-1')->assertUnprocessable()->assertJsonValidationErrors('offset');
        $this->getJson('/api/admin/reports?offset=abc')->assertUnprocessable()->assertJsonValidationErrors('offset');
    }

    // ---- Exportación CSV ----

    public function test_export_has_headers_bom_and_exact_columns()
    {
        $admin = $this->actAsAdmin();
        $zone = $this->makeZone('Puerto Montt');
        $report = $this->makeReport([
            'zone_id' => $zone->id, 'user_id' => User::factory()->create(['name' => 'Ana'])->id, 'validation_status' => 'valido',
            'validated_by' => $admin->id, 'validated_at' => now(), 'status' => 'Resuelto', 'status_updated_by' => $admin->id, 'status_updated_at' => now(),
        ]);
        Confirmation::create(['user_id' => $admin->id, 'report_id' => $report->id]);

        $response = $this->get('/api/admin/reports/export')->assertOk();
        $this->assertSame('text/csv; charset=UTF-8', $response->headers->get('Content-Type'));
        $this->assertStringContainsString('attachment', $response->headers->get('Content-Disposition'));
        $this->assertStringContainsString('filename=reportes-'.now()->format('Y-m-d').'.csv', $response->headers->get('Content-Disposition'));

        $content = $response->streamedContent();
        $this->assertStringStartsWith("\xEF\xBB\xBF", $content);

        $rows = $this->csvLines($content);
        $this->assertSame(
            'id,categoria,descripcion,zona,autor,estado,validacion,motivo_rechazo,confirmaciones,latitud,longitud,creado,validado_por,validado_en,estado_actualizado_por,estado_actualizado_en',
            implode(',', $rows[0])
        );
        $this->assertCount(2, $rows);
        $row = array_combine($rows[0], $rows[1]);
        $this->assertSame((string) $report->id, $row['id']);
        $this->assertSame('basura', $row['categoria']);
        $this->assertSame('Puerto Montt', $row['zona']);
        $this->assertSame('Ana', $row['autor']);
        $this->assertSame('Resuelto', $row['estado']);
        $this->assertSame('valido', $row['validacion']);
        $this->assertSame('1', $row['confirmaciones']);
        $this->assertSame('-41.32', $row['latitud']);
        $this->assertSame($admin->name, $row['validado_por']);
        $this->assertSame($admin->name, $row['estado_actualizado_por']);
        $this->assertSame($report->fresh()->created_at->toISOString(), $row['creado']);
        $this->assertNotSame('', $row['validado_en']);
    }

    public function test_export_applies_filters_and_sort()
    {
        $this->actAsAdmin();
        $this->makeReport(['description' => 'alfa uno', 'validation_status' => 'valido']);
        $match = $this->makeReport(['description' => 'alfa dos']);
        $this->makeReport(['description' => 'beta']);

        $rows = $this->csvLines($this->get('/api/admin/reports/export?search=alfa&validation_status=pendiente')->streamedContent());
        $this->assertCount(2, $rows);
        $this->assertSame((string) $match->id, $rows[1][0]);

        $this->get('/api/admin/reports/export?sort=azar', ['Accept' => 'application/json'])->assertUnprocessable();
        $this->get('/api/admin/reports/export?status=Nada', ['Accept' => 'application/json'])->assertUnprocessable();
    }

    public function test_export_escapes_csv_and_neutralizes_formulas()
    {
        $this->actAsAdmin();
        $this->makeReport(['description' => "Con \"comillas\", coma\ny salto"]);
        $this->makeReport(['description' => '=cmd|calc!A1']);
        $this->makeReport(['description' => '+1', 'user_id' => User::factory()->create(['name' => '@SUM(A1)'])->id]);
        $this->makeReport(['description' => '-2']);
        $this->makeReport(['description' => "\t tab"]);
        $this->makeReport(['description' => "\r retorno"]);

        $content = $this->get('/api/admin/reports/export?sort=recientes')->streamedContent();
        $this->assertStringContainsString('"Con ""comillas"", coma'."\n".'y salto"', $content);

        $byDesc = collect($this->csvLines($content))->skip(1)->keyBy(fn ($r) => $r[2]);
        $this->assertTrue($byDesc->has("'=cmd|calc!A1"));
        $this->assertTrue($byDesc->has("'+1"));
        $this->assertSame("'@SUM(A1)", $byDesc["'+1"][4]);
        $this->assertTrue($byDesc->has("'-2"));
        $this->assertTrue($byDesc->has("'\t tab"));
        $this->assertTrue($byDesc->has("'\r retorno"));
        // Las coordenadas negativas son números, no texto: no se alteran.
        $this->assertSame('-41.32', $byDesc["'-2"][9]);
    }

    public function test_export_is_capped_to_the_most_recent_rows_in_pages()
    {
        $this->actAsAdmin();
        config(['admin.export_limit' => 3]);
        $ids = collect(range(1, 5))->map(fn () => $this->makeReport()->id);

        $rows = $this->csvLines($this->get('/api/admin/reports/export')->streamedContent());

        $this->assertCount(4, $rows);
        $this->assertSame([$ids[4], $ids[3], $ids[2]], array_map('intval', array_column(array_slice($rows, 1), 0)));
    }
}
