<?php

namespace Tests\Feature;

use App\Models\Category;
use Database\Seeders\CategorySeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CategoryApiTest extends TestCase
{
    use RefreshDatabase;

    public function test_guest_can_list_categories()
    {
        Category::create(['name' => 'basura', 'description' => 'Residuos sólidos', 'icon' => 'trash-outline']);
        Category::create(['name' => 'aguas', 'description' => 'Vertidos líquidos', 'icon' => 'water-outline']);

        $this->getJson('/api/categories')
            ->assertOk()
            ->assertJsonCount(2)
            ->assertJsonFragment([
                'name' => 'basura',
                'description' => 'Residuos sólidos',
                'icon' => 'trash-outline',
            ])
            ->assertJsonFragment([
                'name' => 'aguas',
                'description' => 'Vertidos líquidos',
                'icon' => 'water-outline',
            ]);
    }

    public function test_category_details_are_nullable()
    {
        Category::create(['name' => 'otro']);

        $this->getJson('/api/categories')
            ->assertOk()
            ->assertJsonFragment([
                'name' => 'otro',
                'description' => null,
                'icon' => null,
            ]);
    }

    public function test_category_seeder_populates_description_and_icon()
    {
        $this->seed(CategorySeeder::class);

        $this->assertDatabaseHas('categories', [
            'name' => 'Basura',
            'icon' => 'trash-outline',
        ]);
        $this->assertNotNull(Category::where('name', 'Basura')->value('description'));
        $this->assertDatabaseHas('categories', [
            'name' => 'Aguas',
            'icon' => 'water-outline',
        ]);
    }
}
