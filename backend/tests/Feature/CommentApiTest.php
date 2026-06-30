<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\Comment;
use App\Models\Report;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class CommentApiTest extends TestCase
{
    use RefreshDatabase;

    private function makeReport(User $user): Report
    {
        $category = Category::create(['name' => 'aguas']);
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

    public function test_guest_can_list_comments()
    {
        $user    = User::factory()->create();
        $report  = $this->makeReport($user);

        Comment::create([
            'user_id'   => $user->id,
            'report_id' => $report->id,
            'body'      => 'Sigo viendo el mismo problema.',
        ]);

        $response = $this->getJson("/api/reports/{$report->id}/comments");

        $response->assertOk()
            ->assertJsonCount(1)
            ->assertJsonFragment(['body' => 'Sigo viendo el mismo problema.']);
    }

    public function test_authenticated_user_can_post_comment()
    {
        $owner    = User::factory()->create();
        $reporter = User::factory()->create();
        $report   = $this->makeReport($owner);

        Sanctum::actingAs($reporter);

        $response = $this->postJson("/api/reports/{$report->id}/comments", [
            'body' => 'Este problema persiste desde hace semanas.',
        ]);

        $response->assertCreated()
            ->assertJsonStructure([
                'id', 'body',
                'user' => ['id', 'name'],
                'created_at',
            ])
            ->assertJsonFragment(['body' => 'Este problema persiste desde hace semanas.']);

        $this->assertDatabaseHas('comments', [
            'user_id'   => $reporter->id,
            'report_id' => $report->id,
            'body'      => 'Este problema persiste desde hace semanas.',
        ]);
    }

    public function test_comment_body_is_required()
    {
        $user   = User::factory()->create();
        $report = $this->makeReport($user);

        Sanctum::actingAs($user);

        $this->postJson("/api/reports/{$report->id}/comments", ['body' => ''])
            ->assertUnprocessable();
    }

    public function test_comment_body_max_length()
    {
        $user   = User::factory()->create();
        $report = $this->makeReport($user);

        Sanctum::actingAs($user);

        $this->postJson("/api/reports/{$report->id}/comments", [
            'body' => str_repeat('a', 501),
        ])->assertUnprocessable();
    }

    public function test_posting_comment_requires_authentication()
    {
        $user   = User::factory()->create();
        $report = $this->makeReport($user);

        $this->postJson("/api/reports/{$report->id}/comments", ['body' => 'Test'])
            ->assertUnauthorized();
    }

    public function test_comments_are_returned_newest_first()
    {
        $user   = User::factory()->create();
        $report = $this->makeReport($user);

        $first = Comment::create(['user_id' => $user->id, 'report_id' => $report->id, 'body' => 'Primero']);
        $first->forceFill(['created_at' => now()->subMinute()])->saveQuietly();

        Comment::create(['user_id' => $user->id, 'report_id' => $report->id, 'body' => 'Segundo']);

        $response = $this->getJson("/api/reports/{$report->id}/comments");

        $response->assertOk();
        $this->assertEquals('Segundo', $response->json()[0]['body']);
        $this->assertEquals('Primero', $response->json()[1]['body']);
    }
}
