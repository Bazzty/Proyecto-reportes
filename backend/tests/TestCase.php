<?php

namespace Tests;

use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use RuntimeException;

abstract class TestCase extends BaseTestCase
{
    /**
     * RefreshDatabase vacía la BD: se aborta antes si no parece una BD de pruebas.
     * SQLite en memoria siempre es válido; en GitHub Actions la BD de MySQL es desechable.
     */
    protected function setUpTraits()
    {
        $connection = config('database.default');

        if (config("database.connections.{$connection}.driver") !== 'sqlite' && getenv('GITHUB_ACTIONS') !== 'true') {
            $database = (string) config("database.connections.{$connection}.database");

            if (! preg_match('/(^|_)(test|testing)$/i', $database)) {
                throw new RuntimeException(
                    "Los tests se negaron a correr contra la BD \"{$database}\": su nombre debe terminar en _test o testing."
                );
            }
        }

        return parent::setUpTraits();
    }
}
