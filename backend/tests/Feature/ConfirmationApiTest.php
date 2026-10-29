<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Confirmation;
use App\Models\Report;
use App\Models\User;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ConfirmationApiTest extends TestCase
{
    use RefreshDatabase;

    private function makeReport(User $user): Report
    {
        $category = Category::create(['name' => 'basura']);

        return Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Reporte de prueba',
            'latitude' => -41.3198,
            'longitude' => -72.9833,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
        ]);
    }

    public function test_user_can_confirm_a_report()
    {
        $owner = User::factory()->create();
        $reporter = User::factory()->create();
        $report = $this->makeReport($owner);

        Sanctum::actingAs($reporter);

        $response = $this->postJson("/api/reports/{$report->id}/confirm");

        $response->assertOk()
            ->assertJson(['confirmed' => true, 'count' => 1]);

        $this->assertDatabaseHas('confirmations', [
            'user_id' => $reporter->id,
            'report_id' => $report->id,
        ]);
    }

    public function test_user_can_unconfirm_a_report()
    {
        $owner = User::factory()->create();
        $reporter = User::factory()->create();
        $report = $this->makeReport($owner);

        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);

        Sanctum::actingAs($reporter);

        $response = $this->postJson("/api/reports/{$report->id}/confirm");

        $response->assertOk()
            ->assertJson(['confirmed' => false, 'count' => 0]);

        $this->assertDatabaseMissing('confirmations', [
            'user_id' => $reporter->id,
            'report_id' => $report->id,
        ]);
    }

    public function test_report_response_includes_confirmation_fields()
    {
        $owner = User::factory()->create();
        $reporter = User::factory()->create();
        $report = $this->makeReport($owner);

        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);

        Sanctum::actingAs($reporter);

        $response = $this->getJson("/api/reports/{$report->id}");

        $response->assertOk()
            ->assertJsonFragment([
                'confirmations_count' => 1,
                'confirmed_by_me' => true,
            ]);
    }

    public function test_confirmation_requires_authentication()
    {
        $user = User::factory()->create();
        $report = $this->makeReport($user);

        $this->postJson("/api/reports/{$report->id}/confirm")
            ->assertUnauthorized();
    }

    public function test_confirming_unknown_report_returns_404()
    {
        Sanctum::actingAs(User::factory()->create());

        $this->postJson('/api/reports/9999/confirm')->assertNotFound();
    }

    public function test_confirming_twice_leaves_report_unconfirmed()
    {
        $owner = User::factory()->create();
        $reporter = User::factory()->create();
        $report = $this->makeReport($owner);
        Sanctum::actingAs($reporter);

        $this->postJson("/api/reports/{$report->id}/confirm")
            ->assertJson(['confirmed' => true, 'count' => 1]);
        $this->postJson("/api/reports/{$report->id}/confirm")
            ->assertJson(['confirmed' => false, 'count' => 0]);

        $this->assertDatabaseCount('confirmations', 0);
    }

    public function test_owner_cannot_confirm_own_report()
    {
        $owner = User::factory()->create();
        $report = $this->makeReport($owner);
        Sanctum::actingAs($owner);

        $this->postJson("/api/reports/{$report->id}/confirm")
            ->assertForbidden()
            ->assertJson(['message' => 'No puedes confirmar tu propio reporte.']);

        $this->assertDatabaseCount('confirmations', 0);
    }

    public function test_database_rejects_duplicate_confirmation()
    {
        $owner = User::factory()->create();
        $reporter = User::factory()->create();
        $report = $this->makeReport($owner);
        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);

        $this->expectException(QueryException::class);
        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);
    }

    public function test_count_includes_confirmations_from_other_users()
    {
        $owner = User::factory()->create();
        $first = User::factory()->create();
        $second = User::factory()->create();
        $report = $this->makeReport($owner);
        Confirmation::create(['user_id' => $first->id, 'report_id' => $report->id]);

        Sanctum::actingAs($second);

        $this->postJson("/api/reports/{$report->id}/confirm")
            ->assertOk()
            ->assertJson(['confirmed' => true, 'count' => 2]);
    }

    public function test_public_report_endpoints_read_confirmed_by_me_from_bearer_token()
    {
        // Token real en el header (no Sanctum::actingAs): así viaja desde la app a estas rutas públicas.
        $owner = User::factory()->create();
        $reporter = User::factory()->create();
        $report = $this->makeReport($owner);
        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);
        $token = $reporter->createToken('test')->plainTextToken;

        $this->withToken($token)->getJson("/api/reports/{$report->id}")
            ->assertOk()
            ->assertJsonPath('confirmations_count', 1)
            ->assertJsonPath('confirmed_by_me', true);

        $this->withToken($token)->getJson('/api/reports')
            ->assertOk()
            ->assertJsonPath('0.confirmed_by_me', true);
    }

    public function test_guest_sees_count_but_not_confirmed_by_me()
    {
        $owner = User::factory()->create();
        $reporter = User::factory()->create();
        $report = $this->makeReport($owner);
        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);

        $this->getJson("/api/reports/{$report->id}")
            ->assertOk()
            ->assertJsonPath('confirmations_count', 1)
            ->assertJsonPath('confirmed_by_me', false);
    }
}
