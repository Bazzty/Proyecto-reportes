<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Report;
use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ReportStatusConcurrencyTest extends TestCase
{
    use RefreshDatabase;

    private function admin(): User
    {
        $admin = User::factory()->create();
        $admin->roles()->attach(Role::firstOrCreate(['name' => Role::ADMIN])->id);

        return $admin;
    }

    private function makeReport(string $validation): Report
    {
        return Report::create([
            'user_id' => User::factory()->create()->id,
            'category_id' => Category::create(['name' => 'basura'])->id,
            'description' => 'Reporte',
            'latitude' => -41.32,
            'longitude' => -72.98,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
            'validation_status' => $validation,
        ]);
    }

    public function test_status_change_is_rejected_and_nothing_written_when_report_is_no_longer_validated()
    {
        $report = $this->makeReport('pendiente');
        Sanctum::actingAs($this->admin());

        $this->patchJson("/api/reports/{$report->id}/status", ['status' => 'Resuelto'])
            ->assertStatus(409)
            ->assertJsonFragment(['message' => 'Solo se puede cambiar el estado de un reporte validado.']);

        $fresh = $report->fresh();
        $this->assertSame('Pendiente', $fresh->status);
        $this->assertNull($fresh->status_updated_by);
        $this->assertNull($fresh->status_updated_at);
    }

    public function test_status_change_reads_the_report_with_a_row_lock_inside_a_transaction()
    {
        if (DB::connection()->getDriverName() !== 'mysql') {
            $this->markTestSkipped('SQLite omite FOR UPDATE; el bloqueo solo se comprueba en MySQL.');
        }

        $report = $this->makeReport('valido');
        Sanctum::actingAs($this->admin());

        DB::enableQueryLog();
        $this->patchJson("/api/reports/{$report->id}/status", ['status' => 'Resuelto'])->assertOk();

        $locked = collect(DB::getQueryLog())->contains(
            fn ($q) => str_contains($q['query'], 'from `reports`') && str_contains($q['query'], 'for update')
        );
        $this->assertTrue($locked, 'La lectura del reporte debe usar lockForUpdate.');
    }
}
