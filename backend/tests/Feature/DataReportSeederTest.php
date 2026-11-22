<?php

namespace Tests\Feature;

use App\Models\Report;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Database\Seeders\ReportSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DataReportSeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_report_seeder_does_nothing_in_production()
    {
        $this->app['env'] = 'production';

        // En producción db:seed pide confirmación; --force la omite. El guard del propio seeder
        // debe bastar aunque alguien lo invoque directamente con --class.
        $this->artisan('db:seed', ['--class' => ReportSeeder::class, '--force' => true])->assertSuccessful();

        $this->assertSame(0, User::count());
        $this->assertSame(0, Report::count());
    }

    public function test_report_seeder_creates_demo_data_outside_production()
    {
        $this->seed(CategorySeeder::class);
        $this->seed(ReportSeeder::class);

        $this->assertTrue(User::where('email', 'bastian@demo.cl')->exists());
        $this->assertGreaterThan(0, Report::count());
    }

    public function test_seeded_reports_satisfy_moderation_invariants()
    {
        $this->seed(CategorySeeder::class);
        $this->seed(ReportSeeder::class);

        foreach (Report::all() as $r) {
            if ($r->validation_status === 'pendiente') {
                $this->assertSame('Pendiente', $r->status);
                $this->assertNull($r->validated_at);
                $this->assertNull($r->validated_by);
                $this->assertNull($r->status_updated_by);
                $this->assertNull($r->status_updated_at);
            } else {
                $this->assertNotNull($r->validated_at);
            }
            $this->assertNull($r->rejection_reason);
        }
    }
}
