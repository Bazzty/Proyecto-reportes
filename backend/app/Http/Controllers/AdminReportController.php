<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FormatsReports;
use App\Models\Report;
use App\Models\Zone;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminReportController extends Controller
{
    use FormatsReports;

    /** Tope de filas del CSV y tamaño de página al leerlas (se puede bajar con config('admin.export_limit') en tests). */
    private const EXPORT_LIMIT = 5000;

    private const EXPORT_PAGE = 500;

    private const EXPORT_COLUMNS = [
        'id', 'categoria', 'descripcion', 'zona', 'autor', 'estado', 'validacion', 'motivo_rechazo',
        'confirmaciones', 'latitud', 'longitud', 'creado', 'validado_por', 'validado_en',
        'estado_actualizado_por', 'estado_actualizado_en',
    ];

    public function index(Request $request)
    {
        $filters = $this->validatedFilters($request);
        $uid = $request->user()->id;

        // Conteos por validación: respetan zona, categoría, estado y búsqueda, pero no validation_status,
        // para que cada pestaña muestre cuántos hay sin importar cuál esté seleccionada.
        $grouped = $this->applyFilters(Report::query(), $filters, withValidation: false)
            ->selectRaw('validation_status, COUNT(*) as aggregate')
            ->groupBy('validation_status')
            ->pluck('aggregate', 'validation_status');

        $counts = [
            'pendiente' => (int) ($grouped['pendiente'] ?? 0),
            'valido' => (int) ($grouped['valido'] ?? 0),
            'rechazado' => (int) ($grouped['rechazado'] ?? 0),
        ];
        $counts['total'] = array_sum($counts);

        $reports = $this->applySort(
            $this->applyFilters($this->adminQuery($uid), $filters),
            $filters['sort'] ?? 'recientes'
        )->paginate(20);

        return response()->json([
            'data' => $reports->getCollection()->map(fn (Report $report) => $this->formatAdminReport($report, $uid)),
            'meta' => [
                'current_page' => $reports->currentPage(),
                'last_page' => $reports->lastPage(),
                'per_page' => $reports->perPage(),
                'total' => $reports->total(),
                'counts' => $counts,
            ],
        ]);
    }

    public function zones()
    {
        return response()->json(Zone::query()->orderBy('name')->orderBy('id')->get(['id', 'name']));
    }

    public function summary()
    {
        // Promedio calculado en PHP (sin funciones de fecha de la BD): últimos 200 moderados,
        // sin contar los autovalidados (el admin que reporta se valida solo y no mide la cola).
        $moderated = Report::query()
            ->whereIn('validation_status', ['valido', 'rechazado'])
            ->whereNotNull('validated_at')
            ->where(fn ($q) => $q->whereNull('validated_by')->orWhereColumn('validated_by', '!=', 'user_id'))
            ->latest('validated_at')->latest('id')
            ->limit(200)
            ->get(['id', 'created_at', 'validated_at']);

        $avg = $moderated->isEmpty() ? null : round(
            $moderated->avg(fn (Report $r) => max(0, $r->validated_at->getTimestamp() - $r->created_at->getTimestamp())) / 3600,
            1
        );

        $top = Report::query()
            ->whereNotNull('zone_id')
            ->where('validation_status', '!=', 'rechazado')
            ->selectRaw('zone_id, COUNT(*) as aggregate')
            ->groupBy('zone_id')
            ->orderByDesc('aggregate')
            ->orderBy('zone_id')
            ->first();
        $topZone = $top ? Zone::find($top->zone_id, ['id', 'name']) : null;

        return response()->json([
            'total' => Report::count(),
            'pending' => Report::where('validation_status', 'pendiente')->count(),
            'new_this_week' => Report::where('created_at', '>=', now()->subDays(7))->count(),
            'avg_validation_hours' => $avg,
            'top_zone' => $topZone ? [
                'id' => $topZone->id,
                'name' => $topZone->name,
                'count' => (int) $top->aggregate,
            ] : null,
        ]);
    }

    public function bulkValidation(Request $request)
    {
        $data = $request->validate([
            'ids' => ['required', 'array', 'min:1', 'max:50'],
            'ids.*' => ['integer', 'distinct', 'exists:reports,id'],
            'validation_status' => ['required', Rule::in(['valido', 'rechazado'])],
            'rejection_reason' => ['nullable', 'string', 'max:500', 'required_if:validation_status,rechazado'],
        ]);

        $uid = $request->user('sanctum')->id;
        $ids = array_map('intval', $data['ids']);

        // Selección bloqueada dentro de la transacción + UPDATE condicionado: dos admins
        // simultáneos no pisan; el segundo ve los reportes ya moderados y los omite.
        $updated = DB::transaction(function () use ($ids, $data, $uid) {
            $pending = Report::query()
                ->whereIn('id', $ids)
                ->where('validation_status', 'pendiente')
                ->lockForUpdate()
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();

            if ($pending !== []) {
                Report::whereIn('id', $pending)->where('validation_status', 'pendiente')->update([
                    'validation_status' => $data['validation_status'],
                    'rejection_reason' => $data['validation_status'] === 'rechazado' ? $data['rejection_reason'] : null,
                    'validated_by' => $uid,
                    'validated_at' => now(),
                ]);
            }

            return $pending;
        });

        return response()->json([
            // Se conserva el orden en que llegaron los ids.
            'updated' => array_values(array_filter($ids, fn ($id) => in_array($id, $updated, true))),
            'skipped' => array_values(array_diff($ids, $updated)),
        ]);
    }

    public function export(Request $request)
    {
        $filters = $this->validatedFilters($request);
        $uid = $request->user()->id;
        $limit = (int) config('admin.export_limit', self::EXPORT_LIMIT);

        $query = $this->applySort(
            $this->applyFilters($this->adminQuery($uid), $filters),
            $filters['sort'] ?? 'recientes'
        );

        return response()->streamDownload(function () use ($query, $limit) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $this->csvRow($out, self::EXPORT_COLUMNS);

            // Páginas con eager loading (cursor() no lo permite): sin N+1 y sin cargar todo en memoria.
            for ($offset = 0; $offset < $limit; $offset += self::EXPORT_PAGE) {
                $page = (clone $query)->offset($offset)->limit(min(self::EXPORT_PAGE, $limit - $offset))->get();

                foreach ($page as $r) {
                    $this->csvRow($out, [
                        $r->id,
                        $r->category?->name,
                        $r->description,
                        $r->zone?->name,
                        $r->user?->name,
                        $r->status,
                        $r->validation_status,
                        $r->rejection_reason,
                        $r->confirmations_count,
                        (float) $r->latitude,
                        (float) $r->longitude,
                        $r->created_at?->toISOString(),
                        $r->validatedBy?->name,
                        $r->validated_at?->toISOString(),
                        $r->statusUpdatedBy?->name,
                        $r->status_updated_at?->toISOString(),
                    ]);
                }

                if ($page->count() < self::EXPORT_PAGE) {
                    break;
                }
            }

            fclose($out);
        }, 'reportes-'.now()->format('Y-m-d').'.csv', [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }

    public function updateValidation(Request $request, int $id)
    {
        $data = $request->validate([
            'validation_status' => ['required', Rule::in(['pendiente', 'valido', 'rechazado'])],
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
            ->update($data['validation_status'] === 'pendiente'
                // Deshacer: vuelve al estado inicial y borra todo rastro de la moderación y del cambio de estado.
                ? [
                    'validation_status' => 'pendiente',
                    'rejection_reason' => null,
                    'validated_by' => null,
                    'validated_at' => null,
                    'status' => 'Pendiente',
                    'status_updated_by' => null,
                    'status_updated_at' => null,
                ]
                : [
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
        $report->refresh()->load(['category', 'user', 'zone:id,name', 'validatedBy:id,name', 'statusUpdatedBy:id,name']);
        $report->loadCount('confirmations');
        $report->confirmed_by_me = $report->confirmations()->where('user_id', $uid)->exists();

        return response()->json($this->formatAdminReport($report, $uid));
    }

    private function validatedFilters(Request $request): array
    {
        $filters = $request->validate([
            'validation_status' => ['nullable', Rule::in(['pendiente', 'valido', 'rechazado'])],
            'zone_id' => ['nullable', 'integer', 'exists:zones,id'],
            'category_id' => ['nullable', 'integer', 'exists:categories,id'],
            'status' => ['nullable', Rule::in(['Pendiente', 'En Progreso', 'Resuelto'])],
            'search' => ['nullable', 'string', 'max:100'],
            'sort' => ['nullable', Rule::in(['recientes', 'confirmaciones'])],
        ]);

        $filters['search'] = trim((string) ($filters['search'] ?? ''));

        return $filters;
    }

    private function adminQuery(int $uid)
    {
        return $this->withReportData(Report::query(), $uid)->with(['validatedBy:id,name', 'statusUpdatedBy:id,name']);
    }

    private function applyFilters($query, array $filters, bool $withValidation = true)
    {
        return $query
            ->when($withValidation ? ($filters['validation_status'] ?? null) : null, fn ($q, $value) => $q->where('validation_status', $value))
            ->when($filters['zone_id'] ?? null, fn ($q, $value) => $q->where('zone_id', $value))
            ->when($filters['category_id'] ?? null, fn ($q, $value) => $q->where('category_id', $value))
            ->when($filters['status'] ?? null, fn ($q, $value) => $q->where('status', $value))
            ->when($filters['search'] !== '', function ($q) use ($filters) {
                // Escape con "!" (portable entre MySQL y SQLite): %, _ y el propio escape son texto literal
                // (con ESCAPE explícito la barra invertida ya es un carácter común).
                $like = '%'.str_replace(['!', '%', '_'], ['!!', '!%', '!_'], $filters['search']).'%';

                $q->where(function ($q) use ($like) {
                    $q->whereRaw("reports.description LIKE ? ESCAPE '!'", [$like])
                        ->orWhereHas('user', fn ($u) => $u->whereRaw("users.name LIKE ? ESCAPE '!'", [$like]))
                        ->orWhereHas('zone', fn ($z) => $z->whereRaw("zones.name LIKE ? ESCAPE '!'", [$like]));
                });
            });
    }

    private function applySort($query, string $sort)
    {
        if ($sort === 'confirmaciones') {
            $query->orderByDesc('confirmations_count');
        }

        return $query->latest()->latest('id');
    }

    /** Escribe una fila CSV neutralizando inyección de fórmulas en las celdas de texto. */
    private function csvRow($out, array $row): void
    {
        $row = array_map(function ($value) {
            if (is_string($value) && $value !== '' && in_array($value[0], ['=', '+', '-', '@', "\t", "\r"], true)) {
                return "'".$value;
            }

            return $value;
        }, $row);

        fputcsv($out, $row, ',', '"', '');
    }

    private function formatAdminReport(Report $report, ?int $authUserId): array
    {
        return array_merge($this->formatReport($report, $authUserId), [
            'validated_by' => $report->validatedBy ? [
                'id' => $report->validatedBy->id,
                'name' => $report->validatedBy->name,
            ] : null,
            'status_updated_by' => $report->statusUpdatedBy ? [
                'id' => $report->statusUpdatedBy->id,
                'name' => $report->statusUpdatedBy->name,
            ] : null,
            'status_updated_at' => $report->status_updated_at?->toISOString(),
            // El admin que reporta se valida solo; el panel lo distingue de una moderación real.
            'auto_validated' => $report->validated_by !== null && (int) $report->validated_by === (int) $report->user_id,
        ]);
    }
}
