<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DataReportsUserIdIndexTest extends TestCase
{
    use RefreshDatabase;

    public function test_reports_has_an_explicit_single_column_index_on_user_id()
    {
        // Sin él, el unique (user_id, client_uuid) es el único índice que sostiene la FK en MySQL
        // y revertir 2026_10_30_000001 falla al intentar eliminarlo.
        $this->assertTrue(Schema::hasIndex('reports', ['user_id']));
    }

    public function test_the_composite_unique_index_is_still_present()
    {
        $this->assertTrue(Schema::hasIndex('reports', ['user_id', 'client_uuid'], 'unique'));
    }
}
