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
            // Obligatorio: el cliente debe declarar el estado que vio (concurrencia optimista).
            'expected_validation_status' => ['required', Rule::in(['pendiente', 'valido', 'rechazado'])],
        ]);

        $uid = $request->user('sanctum')->id;
        $report = Report::findOrFail($id);

        // UPDATE atómico: solo aplica si el estado sigue siendo el esperado. Si dos admins
        // validan a la vez, el segundo afecta 0 filas y recibe 409.
        $affected = Report::whereKey($id)
            ->where('validation_status', $data['expected_validation_status'])
            ->update([
                'validation_status' => $data['validation_status'],
                'rejection_reason' => $data['validation_status'] === 'rechazado'
                    ? ($data['rejection_reason'] ?? null)
                    : null,
                'validated_by' => $uid,
                'validated_at' => now(),
            ]);

        if ($affected === 0) {
            // MySQL cuenta filas modificadas: un re-envío idempotente del mismo estado
            // (expected == nuevo) puede dar 0 sin que exista un conflicto real.
            $isIdempotent = $data['expected_validation_status'] === $data['validation_status']
                && Report::whereKey($id)->where('validation_status', $data['expected_validation_status'])->exists();

            if (! $isIdempotent) {
                abort(409, 'El estado del reporte cambió; recargá la lista antes de volver a intentarlo.');
            }
        }

        // Respuesta liviana: se cargan solo las relaciones necesarias en vez de re-consultar todo.
        $report->refresh()->load(['category', 'user', 'zone:id,name', 'validatedBy:id,name']);
        $report->loadCount('confirmations');
        $report->confirmed_by_me = $report->confirmations()->where('user_id', $uid)->exists();

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
