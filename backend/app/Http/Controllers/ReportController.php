<?php

namespace App\Http\Controllers;

use App\Models\Report;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function index(Request $request)
    {
        $uid = $request->user()?->id;
        $reports = $this->withReportData(Report::query(), $uid)->latest()->latest('id')->get();

        return response()->json($reports->map(fn (Report $report) => $this->formatReport($report, $uid)));
    }

    public function show(Request $request, int $id)
    {
        $uid = $request->user()?->id;
        $report = $this->withReportData(Report::query(), $uid)->findOrFail($id);

        return response()->json($this->formatReport($report, $uid));
    }

    public function store(Request $request)
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
                'description' => $data['description'],
                'latitude' => $data['latitude'],
                'longitude' => $data['longitude'],
                'photo_path' => $path,
                'status' => 'Pendiente',
            ]);
        } catch (QueryException $exception) {
            if ($clientUuid === null) {
                throw $exception;
            }

            // Carrera: otro request con el mismo client_uuid lo creó primero.
            $report = Report::where('client_uuid', $clientUuid)->firstOrFail();
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

    public function heatmap()
    {
        $points = Report::select('latitude', 'longitude')->get()->map(fn (Report $report) => [
            'latitude' => (float) $report->latitude,
            'longitude' => (float) $report->longitude,
        ]);

        return response()->json($points);
    }

    private function withReportData(Builder|Relation $query, ?int $authUserId): Builder|Relation
    {
        $query->with(['category', 'user'])->withCount('confirmations');

        return $authUserId === null
            ? $query
            : $query->withExists(['confirmations as confirmed_by_me' => fn ($q) => $q->where('user_id', $authUserId)]);
    }

    private function formatReport(Report $report, ?int $authUserId = null): array
    {
        return [
            'id' => $report->id,
            'description' => $report->description,
            'latitude' => (float) $report->latitude,
            'longitude' => (float) $report->longitude,
            'photo_url' => $report->photo_path ? url('storage/'.$report->photo_path) : null,
            'status' => $report->status,
            'category' => $report->category ? [
                'id' => $report->category->id,
                'name' => $report->category->name,
            ] : null,
            'user' => $report->user ? [
                'id' => $report->user->id,
                'name' => $report->user->name,
            ] : null,
            'confirmations_count' => $report->confirmations_count,
            'confirmed_by_me' => (bool) $report->confirmed_by_me,
            'created_at' => $report->created_at?->toISOString(),
        ];
    }
}
