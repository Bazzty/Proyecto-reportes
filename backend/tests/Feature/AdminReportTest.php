<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AdminReportTest extends TestCase
{
    use RefreshDatabase;

    private function makeAdmin(): User
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::firstOrCreate(['name' => Role::ADMIN])->id);

        return $admin;
    }

    private function makeReport(User $user, Category $category, string $validation = 'pendiente'): Report
    {
        return Report::create([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Reporte de prueba',
            'latitude' => -41.32,
            'longitude' => -72.98,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
            'validation_status' => $validation,
        ]);
    }

    public function test_admin_endpoints_require_authentication()
    {
        $this->getJson('/api/admin/reports')->assertUnauthorized();
    }

    public function test_non_admin_cannot_list_admin_reports()
    {
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->getJson('/api/admin/reports')->assertForbidden();
    }

    public function test_non_admin_cannot_validate_a_report()
    {
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport(User::factory()->create(), $category);
        Sanctum::actingAs(User::factory()->create(), ['*']);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", ['validation_status' => 'valido'])
            ->assertForbidden();
    }

    public function test_admin_can_list_reports_with_meta()
    {
        $category = Category::create(['name' => 'basura']);
        $this->makeReport(User::factory()->create(), $category);
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $this->getJson('/api/admin/reports')
            ->assertOk()
            ->assertJsonStructure(['data', 'meta' => ['current_page', 'last_page', 'per_page', 'total']])
            ->assertJsonPath('meta.total', 1);
    }

    public function test_admin_can_filter_by_validation_status()
    {
        $category = Category::create(['name' => 'basura']);
        $user = User::factory()->create();
        $this->makeReport($user, $category, 'valido');
        $this->makeReport($user, $category, 'rechazado');
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $this->getJson('/api/admin/reports?validation_status=rechazado')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.validation_status', 'rechazado');
    }

    public function test_admin_can_validate_a_report()
    {
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport(User::factory()->create(), $category);
        $admin = $this->makeAdmin();
        Sanctum::actingAs($admin, ['*']);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", ['validation_status' => 'valido'])
            ->assertOk()
            ->assertJsonPath('validation_status', 'valido');

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'validation_status' => 'valido',
            'validated_by' => $admin->id,
        ]);
        $this->assertNotNull($report->fresh()->validated_at);
    }

    public function test_rejecting_requires_a_reason()
    {
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport(User::factory()->create(), $category);
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", ['validation_status' => 'rechazado'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('rejection_reason');
    }

    public function test_admin_can_reject_with_a_reason()
    {
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport(User::factory()->create(), $category);
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", [
            'validation_status' => 'rechazado',
            'rejection_reason' => 'No corresponde a contaminación.',
        ])->assertOk();

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'validation_status' => 'rechazado',
            'rejection_reason' => 'No corresponde a contaminación.',
        ]);
    }

    public function test_update_validation_rejects_invalid_status()
    {
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport(User::factory()->create(), $category);
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", ['validation_status' => 'quizas'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('validation_status');
    }

    public function test_update_validation_rejects_stale_expected_status()
    {
        $category = Category::create(['name' => 'basura']);
        $report = $this->makeReport(User::factory()->create(), $category, 'valido');
        Sanctum::actingAs($this->makeAdmin(), ['*']);

        $this->patchJson("/api/admin/reports/{$report->id}/validation", [
            'validation_status' => 'rechazado',
            'rejection_reason' => 'Motivo',
            'expected_validation_status' => 'pendiente',
        ])->assertStatus(409);

        $this->assertDatabaseHas('reports', [
            'id' => $report->id,
            'validation_status' => 'valido',
        ]);
    }
}
