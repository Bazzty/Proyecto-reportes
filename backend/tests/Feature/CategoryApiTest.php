<?php

namespace Tests\Feature;

use App\Models\Category;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_list_categories()
    {
        Category::create(['name' => 'basura']);
        Category::create(['name' => 'aguas']);

        $this->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment(['name' => 'basura'])
            ->assertJsonFragment(['name' => 'aguas']);
    }
}
