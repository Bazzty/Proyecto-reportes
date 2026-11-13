<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FormatsReports;
use App\Models\Report;
use App\Services\ZoneResolver;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ReportController extends Controller
{
    use FormatsReports;

    public function index(Request $request)
    {
        // index y show son rutas públicas: el guard por defecto (web) no lee el Bearer.
        $uid = $request->user('sanctum')?->id;
        // El mapa público muestra solo reportes validados; el autor ve además los suyos pendientes,
        // para no perder de vista el que acaba de enviar mientras espera moderación.
        $reports = $this->withReportData(Report::query(), $uid)
            ->where(fn ($q) => $q->where('validation_status', 'valido')
                ->when($uid, fn ($q) => $q->orWhere(fn ($q) => $q
                    ->where('user_id', $uid)
                    ->where('validation_status', 'pendiente'))))
            ->latest()->latest('id')->get();

        return response()->json($reports->map(fn (Report $report) => $this->formatReport($report, $uid)));
    }

    public function show(Request $request, int $id)
    {
        $user = $request->user('sanctum');
        $uid = $user?->id;
        $report = $this->withReportData(Report::query(), $uid)->findOrFail($id);

        // Los reportes no validados no son visibles públicamente (sí para el dueño o un admin).
        if (! $report->isVisibleTo($user)) {
            abort(404);
        }

        return response()->json($this->formatReport($report, $uid));
    }

    public function store(Request $request, ZoneResolver $zones)
    {
        $data = $request->validate([
            'description' => 'required|string|max:1000',
            'latitude' => 'required|numeric|between:-90,90',
            'longitude' => 'required|numeric|between:-180,180',
            'category_id' => 'required|integer|exists:categories,id',
            'photo' => 'required|file|mimes:jpeg,jpg,png,webp,gif|max:5120',
            'client_uuid' => 'nullable|uuid',
        ]);

        $uid = $request->user()->id;
        $clientUuid = $data['client_uuid'] ?? null;

        // Idempotencia: si el reporte ya fue creado con este client_uuid (reintento
        // de la cola offline), devolvemos el existente en lugar de duplicarlo.
        if ($clientUuid !== null) {
            $existing = $this->withReportData(Report::query(), $uid)
                ->where('user_id', $uid)
                ->where('client_uuid', $clientUuid)
                ->first();

            if ($existing) {
                return response()->json($this->formatReport($existing, $uid), 200);
            }
        }

        $path = $request->file('photo')->store('photos', 'public');

        try {
            // Todo reporte nace pendiente (también el de un administrador): solo es público
            // cuando alguien lo aprueba desde el panel de administración.
            $report = Report::create([
                'validation_status' => 'pendiente',
                'user_id' => $request->user()->id,
                'client_uuid' => $clientUuid,
                'category_id' => $data['category_id'],
                'zone_id' => $zones->resolve((float) $data['latitude'], (float) $data['longitude'])?->id,
                'description' => $data['description'],
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'photo_path' => $path,
                'status' => 'Pendiente',
            ]);
        } catch (UniqueConstraintViolationException $exception) {
            if ($clientUuid === null) {
                throw $exception;
            }

            // Carrera: otro request con el mismo client_uuid del mismo usuario lo creó primero.
            // Se descarta la foto recién subida y se devuelve el reporte existente.
            Storage::disk('public')->delete($path);
            $report = Report::where('user_id', $uid)->where('client_uuid', $clientUuid)->firstOrFail();
        } catch (\Throwable $exception) {
            // Cualquier otro fallo al insertar deja la foto sin reporte: se borra.
            Storage::disk('public')->delete($path);

            throw $exception;
        }

        $report = $this->withReportData(Report::query(), $uid)->findOrFail($report->id);

        return response()->json($this->formatReport($report, $uid), 201);
    }

    public function userReports(Request $request)
    {
        $uid = $request->user()->id;
        $reports = $this->withReportData($request->user()->reports(), $uid)->latest()->latest('id')->get();

        return response()->json($reports->map(fn (Report $report) => $this->formatReport($report, $uid)));
    }

    public function updateStatus(Request $request, int $id)
    {
        $data = $request->validate([
            'status' => ['required', Rule::in(['Pendiente', 'En Progreso', 'Resuelto'])],
        ]);

        $report = Report::findOrFail($id);

        // Solo se cambia el estado de un reporte validado (no rechazado ni pendiente de validación).
        if ($report->validation_status !== 'valido') {
            abort(409, 'Solo se puede cambiar el estado de un reporte validado.');
        }

        $report->status = $data['status'];
        $report->status_updated_by = $request->user()->id;
        $report->status_updated_at = now();
        $report->save();

        $uid = $request->user()->id;
        $report = $this->withReportData(Report::query(), $uid)->with('statusUpdatedBy:id,name')->findOrFail($report->id);

        // Solo lo llaman administradores: se devuelve también quién y cuándo cambió el estado,
        // para que el panel actualice el historial de la tarjeta sin recargar.
        return response()->json(array_merge($this->formatReport($report, $uid), $this->formatStatusUpdate($report)));
    }

    /**
     * Huella de lo que muestran /reports, /reports/heatmap y /user/reports: cambia al crear, moderar
     * o cambiar de estado un reporte (updated_at) y al confirmar o quitar una confirmación. Son dos
     * agregados sobre índices, mucho más baratos que los listados completos que la app pide cada 5 s.
     */
    public function version()
    {
        $reports = DB::table('reports')->selectRaw('COUNT(*) as total, MAX(id) as max_id, MAX(updated_at) as updated')->first();
        $confirmations = DB::table('confirmations')->selectRaw('COUNT(*) as total, MAX(id) as max_id')->first();

        return response()->json([
            'version' => sha1(json_encode([
                (int) $reports->total, (int) $reports->max_id, (string) $reports->updated,
                (int) $confirmations->total, (int) $confirmations->max_id,
            ])),
        ]);
    }

    public function heatmap()
    {
        // Filas planas con join: evita hidratar modelos (y el GeoJSON de cada zona) en un endpoint público.
        $points = DB::table('reports')
            ->leftJoin('zones', 'zones.id', '=', 'reports.zone_id')
            ->where('reports.validation_status', 'valido')
            ->get(['reports.latitude', 'reports.longitude', 'zones.id as zone_id', 'zones.name as zone_name']);

        return response()->json($points->map(fn ($point) => [
            'latitude' => (float) $point->latitude,
            'longitude' => (float) $point->longitude,
            'zone' => $point->zone_id !== null
                ? ['id' => (int) $point->zone_id, 'name' => $point->zone_name]
                : null,
        ]));
    }
}
