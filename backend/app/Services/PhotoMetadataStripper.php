<?php

namespace App\Services;

/**
 * Quita de un JPEG los segmentos de metadatos que pueden llevar la ubicación del teléfono:
 * APP1 (EXIF, con el GPS, y XMP) y APP13 (IPTC). Trabaja sobre los bytes, sin GD: la imagen
 * no se re-codifica, así que no pierde calidad.
 *
 * Nota: sin EXIF también se pierde la etiqueta de orientación. La app ya envía la foto
 * normalizada (expo-image-manipulator), así que solo afecta a clientes que llamen a la API directo.
 */
class PhotoMetadataStripper
{
    private const STRIPPED_MARKERS = [0xE1, 0xED]; // APP1, APP13

    /**
     * Devuelve el JPEG sin esos segmentos, o null si los bytes no son un JPEG que se pueda recorrer
     * con seguridad (en ese caso quien llama decide qué hacer).
     */
    public function stripJpeg(string $bytes): ?string
    {
        $length = strlen($bytes);
        if ($length < 4 || $bytes[0] !== "\xFF" || $bytes[1] !== "\xD8") {
            return null;
        }

        $out = "\xFF\xD8";
        $offset = 2;

        while ($offset + 4 <= $length) {
            if ($bytes[$offset] !== "\xFF") {
                return null;
            }

            $marker = ord($bytes[$offset + 1]);

            // Relleno entre segmentos (0xFF repetido).
            if ($marker === 0xFF) {
                $offset++;

                continue;
            }

            // SOS: a partir de aquí van los datos de la imagen; se copian tal cual.
            if ($marker === 0xDA) {
                return $out.substr($bytes, $offset);
            }

            // Marcadores sin longitud (RSTn, TEM).
            if (($marker >= 0xD0 && $marker <= 0xD7) || $marker === 0x01) {
                $out .= substr($bytes, $offset, 2);
                $offset += 2;

                continue;
            }

            $segmentLength = (ord($bytes[$offset + 2]) << 8) | ord($bytes[$offset + 3]);
            if ($segmentLength < 2 || $offset + 2 + $segmentLength > $length) {
                return null;
            }

            if (! in_array($marker, self::STRIPPED_MARKERS, true)) {
                $out .= substr($bytes, $offset, 2 + $segmentLength);
            }

            $offset += 2 + $segmentLength;
        }

        return null;
    }
}
