<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Basura',
                'description' => 'Residuos sólidos domésticos o de consumo: bolsas, plásticos, envases y similares.',
                'icon' => 'trash-outline',
            ],
            [
                'name' => 'Escombros',
                'description' => 'Restos de construcción o demolición: hormigón, maderas, cerámicas y escombros en general.',
                'icon' => 'construct-outline',
            ],
            [
                'name' => 'Aguas',
                'description' => 'Vertidos o descargas al agua: aguas grises, efluentes y residuos líquidos.',
                'icon' => 'water-outline',
            ],
            [
                'name' => 'Otro',
                'description' => 'Incidencias ambientales que no calzan en las categorías anteriores.',
                'icon' => 'ellipsis-horizontal',
            ],
        ];

        foreach ($categories as $category) {
            Category::updateOrCreate(
                ['name' => $category['name']],
                ['description' => $category['description'], 'icon' => $category['icon']]
            );
        }
    }
}
