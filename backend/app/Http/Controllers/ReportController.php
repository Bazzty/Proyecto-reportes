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
        $uid = $request->user()?->id;
        $reports = $this->withReportData(Report::query(), $uid)
            ->where('validation_status', '!=', 'rechazado')
            ->latest()->latest('id')->get();

        return response()->json($reports->map(fn (Report $report) => $this->formatReport($report, $uid)));
    }

    public function show(Request $request, int $id)
    {
        $uid = $request->user()?->id;
        $report = $this->withReportData(Report::query(), $uid)->findOrFail($id);

        // Los reportes rechazados no son visibles públicamente (sí para el dueño o un admin).
        if ($report->validation_status === 'rechazado'
            && ! $request->user()?->isAdmin()
            && $report->user_id !== $uid) {
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
            $report = Report::create([
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
        $report->status = $data['status'];
        $report->save();

        $uid = $request->user()->id;
        $report = $this->withReportData(Report::query(), $uid)->findOrFail($report->id);

        return response()->json($this->formatReport($report, $uid));
    }

    public function heatmap()
    {
        // Filas planas con join: evita hidratar modelos (y el GeoJSON de cada zona) en un endpoint público.
        $points = DB::table('reports')
            ->leftJoin('zones', 'zones.id', '=', 'reports.zone_id')
            ->where('reports.validation_status', '!=', 'rechazado')
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
