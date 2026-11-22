<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class UniformNotFoundTest extends TestCase
{
    use RefreshDatabase;

    private const MISSING = 999999;

    private function hiddenReport(): Report
    {
        return Report::create([
            'user_id' => User::factory()->create()->id,
            'category_id' => Category::create(['name' => 'basura'])->id,
            'description' => 'Oculto',
            'latitude' => -41.32,
            'longitude' => -72.98,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
            'validation_status' => 'pendiente',
        ]);
    }

    private function assertReportNotFound($response): void
    {
        $response->assertNotFound()->assertExactJson(['message' => 'Reporte no encontrado.']);
        $this->assertStringNotContainsString('No query results', $response->getContent());
    }

    public function test_show_missing_and_hidden_report_have_identical_body()
    {
        $hidden = $this->hiddenReport();

        $missing = $this->getJson('/api/reports/'.self::MISSING);
        $this->assertReportNotFound($missing);
        $this->assertReportNotFound($this->getJson("/api/reports/{$hidden->id}"));
        $this->assertSame($missing->getContent(), $this->getJson("/api/reports/{$hidden->id}")->getContent());
    }

    public function test_comments_missing_and_hidden_report_have_identical_body()
    {
        $hidden = $this->hiddenReport();

        $this->assertReportNotFound($this->getJson('/api/reports/'.self::MISSING.'/comments'));
        $this->assertReportNotFound($this->getJson("/api/reports/{$hidden->id}/comments"));

        Sanctum::actingAs(User::factory()->create());
        $this->assertReportNotFound($this->postJson('/api/reports/'.self::MISSING.'/comments', ['body' => 'hola']));
        $this->assertReportNotFound($this->postJson("/api/reports/{$hidden->id}/comments", ['body' => 'hola']));
    }

    public function test_confirmation_missing_and_hidden_report_have_identical_body()
    {
        $hidden = $this->hiddenReport();
        Sanctum::actingAs(User::factory()->create());

        $this->assertReportNotFound($this->postJson('/api/reports/'.self::MISSING.'/confirm'));
        $this->assertReportNotFound($this->postJson("/api/reports/{$hidden->id}/confirm"));
    }

    public function test_status_and_admin_report_routes_use_report_message()
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::firstOrCreate(['name' => Role::ADMIN])->id);
        Sanctum::actingAs($admin);

        $this->assertReportNotFound($this->patchJson('/api/reports/'.self::MISSING.'/status', ['status' => 'Resuelto']));
        $this->assertReportNotFound($this->patchJson('/api/admin/reports/'.self::MISSING.'/validation', [
            'validation_status' => 'valido',
            'expected_validation_status' => 'pendiente',
        ]));
    }

    public function test_other_unknown_api_routes_use_generic_message()
    {
        $this->getJson('/api/no-existe')
            ->assertNotFound()
            ->assertExactJson(['message' => 'Recurso no encontrado.']);
    }
}
