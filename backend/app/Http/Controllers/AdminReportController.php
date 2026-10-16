<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FormatsReports;
use App\Models\Report;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminReportController extends Controller
{
    use FormatsReports;

    public function index(Request $request)
    {
        $filters = $request->validate([
            'validation_status' => ['nullable', Rule::in(['pendiente', 'valido', 'rechazado'])],
            'zone_id' => ['nullable', 'integer', 'exists:zones,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
        ]);

        $uid = $request->user()->id;

        $reports = $this->withReportData(Report::query(), $uid)
            ->with('validatedBy:id,name')
            ->when($filters['validation_status'] ?? null, fn ($q, $value) => $q->where('validation_status', $value))
            ->when($filters['zone_id'] ?? null, fn ($q, $value) => $q->where('zone_id', $value))
            ->when($filters['category_id'] ?? null, fn ($q, $value) => $q->where('category_id', $value))
            ->latest()->latest('id')
            ->paginate(20);

        return response()->json([
            'data' => $reports->getCollection()->map(fn (Report $report) => $this->formatAdminReport($report, $uid)),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
            ],
        ]);
    }

    public function updateValidation(Request $request, int $id)
    {
        $data = $request->validate([
            'validation_status' => ['required', Rule::in(['valido', 'rechazado'])],
            'rejection_reason' => ['nullable', 'string', 'max:500', 'required_if:validation_status,rechazado'],
        ]);

        $report = Report::findOrFail($id);
        $report->validation_status = $data['validation_status'];
        $report->rejection_reason = $data['validation_status'] === 'rechazado'
            ? ($data['rejection_reason'] ?? null)
            : null;
        $report->validated_by = $request->user()->id;
        $report->validated_at = now();
        $report->save();

        $uid = $request->user()->id;
        $report = $this->withReportData(Report::query(), $uid)
            ->with('validatedBy:id,name')
            ->findOrFail($report->id);

        return response()->json($this->formatAdminReport($report, $uid));
    }

    private function formatAdminReport(Report $report, ?int $authUserId): array
    {
        return array_merge($this->formatReport($report, $authUserId), [
            'validated_by' => $report->validatedBy ? [
                'id' => $report->validatedBy->id,
                'name' => $report->validatedBy->name,
            ] : null,
        ]);
    }
}
