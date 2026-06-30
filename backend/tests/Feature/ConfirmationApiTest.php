<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Confirmation;
use App\Models\Report;
use App\Models\User;
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
            'user_id'     => $user->id,
            'category_id' => $category->id,
            'description' => 'Reporte de prueba',
            'latitude'    => -41.3198,
            'longitude'   => -72.9833,
            'photo_path'  => 'photos/test.jpg',
            'status'      => 'Pendiente',
        ]);
    }

    public function test_user_can_confirm_a_report()
    {
        $owner    = User::factory()->create();
        $reporter = User::factory()->create();
        $report   = $this->makeReport($owner);

        Sanctum::actingAs($reporter);

        $response = $this->postJson("/api/reports/{$report->id}/confirm");

        $response->assertOk()
            ->assertJson(['confirmed' => true, 'count' => 1]);

        $this->assertDatabaseHas('confirmations', [
            'user_id'   => $reporter->id,
            'report_id' => $report->id,
        ]);
    }

    public function test_user_can_unconfirm_a_report()
    {
        $owner    = User::factory()->create();
        $reporter = User::factory()->create();
        $report   = $this->makeReport($owner);

        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);

        Sanctum::actingAs($reporter);

        $response = $this->postJson("/api/reports/{$report->id}/confirm");

        $response->assertOk()
            ->assertJson(['confirmed' => false, 'count' => 0]);

        $this->assertDatabaseMissing('confirmations', [
            'user_id'   => $reporter->id,
            'report_id' => $report->id,
        ]);
    }

    public function test_report_response_includes_confirmation_fields()
    {
        $owner    = User::factory()->create();
        $reporter = User::factory()->create();
        $report   = $this->makeReport($owner);

        Confirmation::create(['user_id' => $reporter->id, 'report_id' => $report->id]);

        Sanctum::actingAs($reporter);

        $response = $this->getJson("/api/reports/{$report->id}");

        $response->assertOk()
            ->assertJsonFragment([
                'confirmations_count' => 1,
                'confirmed_by_me'     => true,
            ]);
    }

    public function test_confirmation_requires_authentication()
    {
        $user   = User::factory()->create();
        $report = $this->makeReport($user);

        $this->postJson("/api/reports/{$report->id}/confirm")
            ->assertUnauthorized();
    }
}
