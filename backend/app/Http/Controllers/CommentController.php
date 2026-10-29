<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use App\Models\Report;
use Illuminate\Http\Request;

class CommentController extends Controller
{
    public function index(Request $request, int $id)
    {
        $report = Report::findOrFail($id);
        abort_unless($report->isVisibleTo($request->user()), 404);

        return response()->json(
            $report->comments()->with('user:id,name')->latest()->get()
                ->map(fn (Comment $c) => [
                    'id' => $c->id,
                    'body' => $c->body,
                    'user' => $c->user ? ['id' => $c->user->id, 'name' => $c->user->name] : null,
                    'created_at' => $c->created_at?->toISOString(),
                ])
        );
    }

    public function store(Request $request, int $id)
    {
        $report = Report::findOrFail($id);
        abort_unless($report->isVisibleTo($request->user()), 404);

        $data = $request->validate(['body' => 'required|string|max:500']);

        $comment = Comment::create([
            'user_id' => $request->user()->id,
            'report_id' => $report->id,
            'body' => $data['body'],
        ]);

        $comment->load('user:id,name');

        return response()->json([
            'id' => $comment->id,
            'body' => $comment->body,
            'user' => $comment->user ? ['id' => $comment->user->id, 'name' => $comment->user->name] : null,
            'created_at' => $comment->created_at?->toISOString(),
        ], 201);
    }
}
