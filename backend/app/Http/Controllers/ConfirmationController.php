<?php

namespace App\Http\Controllers;

use App\Models\Confirmation;
use App\Models\Report;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ConfirmationController extends Controller
{
    public function toggle(Request $request, int $id)
    {
        $user = $request->user('sanctum');
        $report = Report::findOrFail($id);
        abort_unless($report->isVisibleTo($user), 404);
        $userId = $user->id;

        abort_if((int) $report->user_id === (int) $userId, 403, 'No puedes confirmar tu propio reporte.');

        try {
            $confirmed = DB::transaction(function () use ($userId, $report) {
                $existing = Confirmation::where('user_id', $userId)
                    ->where('report_id', $report->id)
                    ->lockForUpdate()
                    ->first();

                if ($existing) {
                    $existing->delete();

                    return false;
                }

                Confirmation::create(['user_id' => $userId, 'report_id' => $report->id]);

                return true;
            }, 3);
        } catch (UniqueConstraintViolationException) {
            // Dos toggles simultáneos del mismo usuario: el otro insertó primero. Se responde con el
            // estado real (confirmado) en vez de un 500.
            $confirmed = true;
        }

        return response()->json([
            'confirmed' => $confirmed,
            'count' => $report->confirmations()->count(),
        ]);
    }
}
