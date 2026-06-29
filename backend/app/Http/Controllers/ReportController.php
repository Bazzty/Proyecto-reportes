<?php

namespace App\Http\Controllers;

use App\Models\Report;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function index()
    {
        $reports = Report::with(['category', 'user'])->get();

        return response()->json($reports->map(fn (Report $report) => $this->formatReport($report)));
    }

    public function show(int $id)
    {
        $report = Report::with(['category', 'user'])->findOrFail($id);

        return response()->json($this->formatReport($report));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'description' => 'required|string',
            'latitude' => 'required|numeric',
            'longitude' => 'required|numeric',
            'category_id' => 'required|integer|exists:categories,id',
            'photo' => 'required|file|image|max:5120',
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

        $report->load(['category', 'user']);

        return response()->json($this->formatReport($report), 201);
    }

    public function userReports(Request $request)
    {
        $reports = $request->user()->reports()->with(['category', 'user'])->get();

        return response()->json($reports->map(fn (Report $report) => $this->formatReport($report)));
    }

    public function heatmap()
    {
        $points = Report::select('latitude', 'longitude')->get()->map(fn (Report $report) => [
            'latitude' => (float) $report->latitude,
            'longitude' => (float) $report->longitude,
        ]);

        return response()->json($points);
    }

    private function formatReport(Report $report): array
    {
        return [
            'id' => $report->id,
            'description' => $report->description,
            'latitude' => (float) $report->latitude,
            'longitude' => (float) $report->longitude,
            'photo_url' => $report->photo_path ? url('storage/' . $report->photo_path) : null,
            'status' => $report->status,
            'category' => [
                'id' => $report->category->id,
                'name' => $report->category->name,
            ],
            'user' => [
                'id' => $report->user->id,
                'name' => $report->user->name,
            ],
            'created_at' => $report->created_at?->toISOString(),
        ];
    }
}
