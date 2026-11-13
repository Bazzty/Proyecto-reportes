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

    private const PAGE_SIZE = 20;

    // Autovalidación de versiones anteriores: el admin quedaba validado al crear su propio reporte.
    private const AUTO_VALIDATION_SECONDS = 60;

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

        $query = $this->applySort(
            $this->applyFilters($this->adminQuery($uid), $filters),
            $filters['sort'] ?? 'recientes'
        );

        // "Cargar más" pide por offset (cuántas filas tiene ya la app) y no por número de página:
        // al moderar, la app saca reportes de la lista y una página fija saltaría los que suben.
        $offset = $request->validate(['offset' => ['sometimes', 'integer', 'min:0']])['offset'] ?? null;

        if ($offset !== null) {
            $total = (clone $query)->toBase()->getCountForPagination();
            $rows = $query->skip((int) $offset)->take(self::PAGE_SIZE)->get();

            return response()->json([
                'data' => $rows->map(fn (Report $report) => $this->formatAdminReport($report, $uid)),
                'meta' => [
                    'offset' => (int) $offset,
                    'per_page' => self::PAGE_SIZE,
                    'total' => $total,
                    'counts' => $counts,
                ],
            ]);
        }

        $reports = $query->paginate(self::PAGE_SIZE);

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
        // Promedio calculado en PHP (sin funciones de fecha de la BD): últimos 200 moderados. Cuentan
        // todos, también los de administradores: sus reportes esperan en la misma cola que el resto.
        // Se excluye la autovalidación al crear de versiones anteriores (el autor se validó solo en
        // el mismo minuto): no fue una espera en la cola y bajaría el promedio a casi cero.
        $moderated = Report::query()
            ->whereIn('validation_status', ['valido', 'rechazado'])
            ->whereNotNull('validated_at')
            ->latest('validated_at')->latest('id')
            ->limit(200)
            ->get(['id', 'user_id', 'validated_by', 'created_at', 'validated_at'])
            ->reject(fn (Report $r) => $r->validated_by !== null
                && (int) $r->validated_by === (int) $r->user_id
                && $r->validated_at->getTimestamp() - $r->created_at->getTimestamp() < self::AUTO_VALIDATION_SECONDS);

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

        // Los tres conteos en una sola pasada sobre la tabla.
        $totals = Report::query()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN validation_status = 'pendiente' THEN 1 ELSE 0 END) as pending")
            ->selectRaw('SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as new_this_week', [now()->subDays(7)])
            ->toBase()
            ->first();

        return response()->json([
            'total' => (int) $totals->total,
            'pending' => (int) $totals->pending,
            'new_this_week' => (int) $totals->new_this_week,
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
            // exists sobre el array completo: una sola consulta (WHERE id IN ...) en vez de una por id.
            'ids' => ['required', 'array', 'min:1', 'max:50', 'exists:reports,id'],
            'ids.*' => ['integer', 'distinct'],
            'validation_status' => ['required', Rule::in(['valido', 'rechazado'])],
            'rejection_reason' => ['nullable', 'string', 'max:500', 'required_if:validation_status,rechazado'],
        ]);

        $admin = $request->user('sanctum');
        $uid = $admin->id;
        $ids = array_map('intval', $data['ids']);
        // Al segundo, como lo guarda la columna: la fecha devuelta coincide con la almacenada.
        $now = now()->startOfSecond();

        // Selección bloqueada dentro de la transacción + UPDATE condicionado: dos admins
        // simultáneos no pisan; el segundo ve los reportes ya moderados y los omite.
        $updated = DB::transaction(function () use ($ids, $data, $uid, $now) {
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
                    'validated_at' => $now,
                ]);
            }

            return $pending;
        });

        return response()->json([
            // Se conserva el orden en que llegaron los ids.
            'updated' => array_values(array_filter($ids, fn ($id) => in_array($id, $updated, true))),
            'skipped' => array_values(array_diff($ids, $updated)),
            // Quién y cuándo moderó los actualizados: el panel completa el historial de las tarjetas sin recargar.
            'validated_by' => ['id' => $admin->id, 'name' => $admin->name],
            'validated_at' => $now->toISOString(),
        ]);
    }

    public function export(Request $request)
    {
        $filters = $this->validatedFilters($request);
        $limit = (int) config('admin.export_limit', self::EXPORT_LIMIT);

        $sort = $filters['sort'] ?? 'recientes';

        // Foto fija de los ids (en el orden pedido) antes de escribir: un reporte que llegue o cambie
        // durante la descarga no desplaza las páginas, así que no se repiten ni se omiten filas.
        // Consulta liviana: solo el id (y el conteo de confirmaciones si se ordena por él).
        $idQuery = Report::query()->select('reports.id')
            ->when($sort === 'confirmaciones', fn ($q) => $q->withCount('confirmations'));
        $ids = $this->applySort($this->applyFilters($idQuery, $filters), $sort)
            ->limit($limit)->pluck('reports.id')->all();

        return response()->streamDownload(function () use ($ids) {
            $out = fopen('php://output', 'w');
            fwrite($out, "\xEF\xBB\xBF");
            $this->csvRow($out, self::EXPORT_COLUMNS);

            // Páginas con eager loading (cursor() no lo permite): sin N+1 y sin cargar todo en memoria.
            foreach (array_chunk($ids, self::EXPORT_PAGE) as $chunk) {
                $page = $this->withReportData(Report::query(), null)
                    ->with(['validatedBy:id,name', 'statusUpdatedBy:id,name'])
                    ->whereIn('reports.id', $chunk)
                    ->get()
                    ->keyBy('id');

                // Se respeta el orden de la foto; un reporte que ya no existe se omite.
                foreach ($chunk as $id) {
                    $r = $page->get($id);
                    if ($r === null) {
                        continue;
                    }

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
            // Deshacer hacia valido/rechazado: restaura la moderación anterior que guardó el servidor
            // (previous_validated_by/at) en vez de registrar como moderador a quien deshace. El cliente
            // no elige ni el moderador ni la fecha.
            'restore_previous' => ['sometimes', 'boolean', 'prohibited_if:validation_status,pendiente'],
        ]);

        $uid = $request->user('sanctum')->id;
        $report = Report::findOrFail($id);
        $target = $data['validation_status'];
        $restore = (bool) ($data['restore_previous'] ?? false);

        // Fila bloqueada dentro de la transacción: si dos admins moderan a la vez, el segundo ve el
        // estado nuevo, no coincide con el esperado y recibe 409.
        $applied = DB::transaction(function () use ($id, $data, $target, $restore, $uid) {
            $row = Report::whereKey($id)->lockForUpdate()->firstOrFail();

            if ($row->validation_status !== $data['expected_validation_status']) {
                return false;
            }

            // Re-envío idempotente del mismo estado: nada que cambiar, salvo un motivo de rechazo nuevo
            // (corregir el motivo de un reporte ya rechazado).
            if ($row->validation_status === $target) {
                $reason = $data['rejection_reason'] ?? null;
                if ($target === 'rechazado' && $reason !== null && $reason !== $row->rejection_reason) {
                    $row->forceFill(['rejection_reason' => $reason])->save();
                }

                return true;
            }

            if ($target === 'pendiente') {
                // Deshacer una validación: si otro admin ya avanzó el estado (En Progreso / Resuelto),
                // volver a pendiente borraría ese cambio. Se trata como conflicto (409).
                if ($row->validation_status === 'valido' && $row->status !== 'Pendiente') {
                    return false;
                }

                // Vuelve al estado inicial y borra todo rastro de la moderación y del cambio de estado.
                $row->forceFill([
                    'validation_status' => 'pendiente',
                    'rejection_reason' => null,
                    'validated_by' => null,
                    'validated_at' => null,
                    'previous_validated_by' => null,
                    'previous_validated_at' => null,
                    'status' => 'Pendiente',
                    'status_updated_by' => null,
                    'status_updated_at' => null,
                ])->save();

                return true;
            }

            $wasModerated = $row->validation_status !== 'pendiente';

            // Basta con la fecha: si el moderador anterior se eliminó (nullOnDelete) la moderación se
            // restaura igual, sin moderador, en vez de registrar como moderador a quien deshace.
            if ($restore && ($row->previous_validated_by !== null || $row->previous_validated_at !== null)) {
                $by = $row->previous_validated_by;
                $at = $row->previous_validated_at ?? now();
                $previous = [null, null];
            } else {
                $by = $uid;
                $at = now();
                // Cambio entre válido y rechazado: se guarda quién moderó antes para poder deshacerlo.
                $previous = $wasModerated ? [$row->validated_by, $row->validated_at] : [null, null];
            }

            $row->forceFill([
                'validation_status' => $target,
                'rejection_reason' => $target === 'rechazado' ? ($data['rejection_reason'] ?? null) : null,
                'validated_by' => $by,
                'validated_at' => $at,
                'previous_validated_by' => $previous[0],
                'previous_validated_at' => $previous[1],
            ])->save();

            return true;
        });

        if (! $applied) {
            abort(409, 'El estado del reporte cambió; recargá la lista antes de volver a intentarlo.');
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
            ...$this->formatStatusUpdate($report),
            // El admin aprobó o rechazó su propio reporte: el panel lo indica en el historial.
            'auto_validated' => $report->validated_by !== null && (int) $report->validated_by === (int) $report->user_id,
        ]);
    }
}
