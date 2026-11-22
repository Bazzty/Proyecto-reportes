<?php

namespace Tests\Feature;

use App\Models\Category;
use App\Models\User;
use App\Services\PhotoMetadataStripper;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PhotoMetadataTest extends TestCase
{
    use RefreshDatabase;

    private function segment(int $marker, string $payload): string
    {
        return "\xFF".chr($marker).pack('n', strlen($payload) + 2).$payload;
    }

    // JPEG mínimo con JFIF, EXIF (con un "GPS" de mentira), IPTC y datos tras SOS.
    private function jpegWithMetadata(): string
    {
        return "\xFF\xD8"
            .$this->segment(0xE0, "JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00")
            .$this->segment(0xE1, "Exif\x00\x00GPS-33.0458,-71.6197")
            .$this->segment(0xED, 'Photoshop 3.0 IPTC-Location')
            .$this->segment(0xDB, str_repeat("\x01", 65))
            ."\xFF\xDA".pack('n', 8)."\x01\x01\x00\x00\x3F\x00"
            .'IMAGEDATA'
            ."\xFF\xD9";
    }

    public function test_stripper_removes_exif_and_iptc_but_keeps_the_image()
    {
        $clean = (new PhotoMetadataStripper)->stripJpeg($this->jpegWithMetadata());

        $this->assertNotNull($clean);
        $this->assertStringStartsWith("\xFF\xD8", $clean);
        $this->assertStringNotContainsString('Exif', $clean);
        $this->assertStringNotContainsString('GPS', $clean);
        $this->assertStringNotContainsString('IPTC', $clean);
        $this->assertStringContainsString('JFIF', $clean);
        $this->assertStringEndsWith("IMAGEDATA\xFF\xD9", $clean);
    }

    public function test_stripper_rejects_non_jpeg_or_truncated_bytes()
    {
        $stripper = new PhotoMetadataStripper;

        $this->assertNull($stripper->stripJpeg("\x89PNG\r\n"));
        $this->assertNull($stripper->stripJpeg("\xFF\xD8\xFF\xE1\x40\x00Exif"));
    }

    public function test_uploaded_jpeg_is_stored_without_exif()
    {
        Storage::fake('public');
        Sanctum::actingAs(User::factory()->create());
        $category = Category::firstOrCreate(['name' => 'basura']);

        $response = $this->postJson('/api/reports', [
            'description' => 'Basura en la orilla',
            'latitude' => -33.0458,
            'longitude' => -71.6197,
            'category_id' => $category->id,
            'photo' => UploadedFile::fake()->createWithContent('foto.jpg', $this->jpegWithMetadata()),
        ]);

        $response->assertCreated();
        $files = Storage::disk('public')->files('photos');
        $this->assertCount(1, $files);
        $stored = Storage::disk('public')->get($files[0]);
        $this->assertStringNotContainsString('Exif', $stored);
        $this->assertStringNotContainsString('GPS', $stored);
        $this->assertStringContainsString('IMAGEDATA', $stored);
    }
}
