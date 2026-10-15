<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Comment;
use App\Models\Confirmation;
use App\Models\Report;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\CategorySeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DatabaseIntegrityTest extends TestCase
{
    use RefreshDatabase;

    /** SQLite (el motor local de phpunit.xml) no aplica enum ni precisión decimal; CI sí usa MySQL. */
    private function requireMysql(): void
    {
        if (DB::getDriverName() !== 'mysql') {
            $this->markTestSkipped('Requiere MySQL (enum y decimal no se aplican en SQLite).');
        }
    }

    private function makeReport(User $user, Category $category, array $overrides = []): Report
    {
        return Report::create(array_merge([
            'user_id' => $user->id,
            'category_id' => $category->id,
            'description' => 'Reporte de prueba',
            'latitude' => -41.3198000,
            'longitude' => -72.9833000,
            'photo_path' => 'photos/test.jpg',
            'status' => 'Pendiente',
        ], $overrides));
    }

    public function test_category_seeder_creates_four_categories_without_duplicates()
    {
        $this->seed(CategorySeeder::class);
        $this->seed(CategorySeeder::class);

        $this->assertSame(
            ['Aguas', 'Basura', 'Escombros', 'Otro'],
            Category::orderBy('name')->pluck('name')->all()
        );
    }

    public function test_category_names_are_unique()
    {
        Category::create(['name' => 'basura']);

        $this->expectException(QueryException::class);
        Category::create(['name' => 'basura']);
    }

    public function test_roles_are_user_and_admin_without_duplicates()
    {
        $this->assertSame(['admin', 'user'], Role::orderBy('name')->pluck('name')->all());

        $this->expectException(QueryException::class);
        Role::create(['name' => 'admin']);
    }

    public function test_user_cannot_have_the_same_role_twice()
    {
        $user = User::factory()->create();
        $userRole = Role::where('name', 'user')->first();

        $this->expectException(QueryException::class);
        $user->roles()->attach($userRole->id);
    }

    public function test_deleting_a_user_removes_role_assignments_but_not_roles()
    {
        $user = User::factory()->admin()->create();
        $this->assertSame(2, DB::table('role_user')->where('user_id', $user->id)->count());

        $user->delete();

        $this->assertSame(0, DB::table('role_user')->count());
        $this->assertSame(2, Role::count());
    }

    public function test_role_relations_work_from_both_sides()
    {
        $admin = User::factory()->admin()->create();
        User::factory()->create();

        $this->assertSame(2, Role::where('name', 'user')->first()->users()->count());
        $this->assertSame([$admin->id], Role::where('name', 'admin')->first()->users()->pluck('users.id')->all());
    }

    public function test_user_inverse_relations_return_their_records()
    {
        $user = User::factory()->create();
        $report = $this->makeReport($user, Category::create(['name' => 'basura']));
        Confirmation::create(['user_id' => $user->id, 'report_id' => $report->id]);
        Comment::create(['user_id' => $user->id, 'report_id' => $report->id, 'body' => 'hola']);

        $this->assertCount(1, $user->reports);
        $this->assertCount(1, $user->confirmations);
        $this->assertCount(1, $user->comments);
    }

    public function test_report_cannot_reference_missing_user_or_category()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);

        try {
            $this->makeReport($user, $category, ['user_id' => 9999]);
            $this->fail('Se aceptó un reporte con user_id inexistente.');
        } catch (QueryException) {
            $this->assertSame(0, Report::count());
        }

        $this->expectException(QueryException::class);
        $this->makeReport($user, $category, ['category_id' => 9999]);
    }

    public function test_report_status_is_restricted_to_allowed_values()
    {
        $this->requireMysql();

        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);

        $this->expectException(QueryException::class);
        $this->makeReport($user, $category, ['status' => 'Cerrado']);
    }

    public function test_category_with_reports_cannot_be_deleted()
    {
        $user = User::factory()->create();
        $category = Category::create(['name' => 'basura']);
        $this->makeReport($user, $category);

        $this->expectException(QueryException::class);
        $category->delete();
    }

    public function test_deleting_a_report_removes_its_confirmations_and_comments()
    {
        $user = User::factory()->create();
        $report = $this->makeReport($user, Category::create(['name' => 'basura']));
        Confirmation::create(['user_id' => $user->id, 'report_id' => $report->id]);
        Comment::create(['user_id' => $user->id, 'report_id' => $report->id, 'body' => 'hola']);

        $report->delete();

        $this->assertSame(0, Confirmation::count());
        $this->assertSame(0, Comment::count());
    }

    public function test_user_emails_are_unique()
    {
        User::factory()->create(['email' => 'repetido@example.com']);

        $this->expectException(QueryException::class);
        User::factory()->create(['email' => 'repetido@example.com']);
    }

    public function test_coordinates_have_seven_decimals_and_are_indexed()
    {
        $this->requireMysql();

        $user = User::factory()->create();
        $report = $this->makeReport($user, Category::create(['name' => 'basura']), [
            'latitude' => -41.31984567,
            'longitude' => -72.98331234,
        ]);

        $report->refresh();
        $this->assertSame('-41.3198457', $report->latitude);
        $this->assertSame('-72.9833123', $report->longitude);
        $this->assertTrue(Schema::hasIndex('reports', ['latitude', 'longitude']));
    }
}
