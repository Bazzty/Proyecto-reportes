<?php

namespace App\Http\Controllers;

use App\Models\Report;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;
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
        ]);

        $path = $request->file('photo')->store('photos', 'public');

        $report = Report::create([
            'user_id' => $request->user()->id,
            'category_id' => $data['category_id'],
            'description' => $data['description'],
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'photo_path' => $path,
            'status' => 'Pendiente',
        ]);

        $uid = $request->user()->id;
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
        return $query
            ->with(['category', 'user'])
            ->withCount('confirmations')
            ->withExists(['confirmations as confirmed_by_me' => fn ($q) => $q->where('user_id', $authUserId)]);
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
