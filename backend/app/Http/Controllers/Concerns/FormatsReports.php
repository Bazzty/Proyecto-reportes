<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Report;
use Illuminate\Contracts\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Relations\Relation;

trait FormatsReports
{
    protected function withReportData(Builder|Relation $query, ?int $authUserId): Builder|Relation
    {
        $query->with(['category', 'user', 'zone:id,name'])->withCount('confirmations');

        return $authUserId === null
            ? $query
            : $query->withExists(['confirmations as confirmed_by_me' => fn ($q) => $q->where('user_id', $authUserId)]);
    }

    protected function formatReport(Report $report, ?int $authUserId = null): array
    {
        return [
            'id' => $report->id,
            'description' => $report->description,
            'latitude' => (float) $report->latitude,
            'longitude' => (float) $report->longitude,
            'photo_url' => $report->photo_path ? url('storage/'.$report->photo_path) : null,
            'status' => $report->status,
            'validation_status' => $report->validation_status,
            'rejection_reason' => $report->rejection_reason,
            'validated_at' => $report->validated_at?->toISOString(),
            'category' => $report->category ? [
                'id' => $report->category->id,
                'name' => $report->category->name,
            ] : null,
            'zone' => $report->zone ? [
                'id' => $report->zone->id,
                'name' => $report->zone->name,
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

    /** Quién y cuándo cambió el estado del reporte (requiere la relación statusUpdatedBy cargada). */
    protected function formatStatusUpdate(Report $report): array
    {
        return [
            'status_updated_by' => $report->statusUpdatedBy ? [
                'id' => $report->statusUpdatedBy->id,
                'name' => $report->statusUpdatedBy->name,
            ] : null,
            'status_updated_at' => $report->status_updated_at?->toISOString(),
        ];
    }
}
