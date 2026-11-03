"use client";
// Diary: quick-pick standard entries [3.4I], overdue highlighting [3.4K], owner-only editing [3.4L].
import { useState } from "react";
import {
  Card,
  ResultMessage,
  btnPrimary,
  btnSecondary,
  inputCls,
  labelCls,
  rowCls,
  tableCls,
  td,
  th,
  theadCls,
} from "@/components/ui";
import { addDiary, completeDiary, defaultDueDate, updateDiary, type Result } from "@/lib/actions";
import { DIARY_CODES, diaryLabel } from "@/lib/codes";
import { TODAY, addDays, daysBetween } from "@/lib/dates";
import { fmtDate } from "@/lib/format";
import { canEditClaim } from "@/lib/permissions";
import type { AppState } from "@/lib/store";
import type { Claim, DiaryEntry } from "@/lib/types";
import { userName } from "@/lib/users";

export default function DiaryTab({ s, claim }: { s: AppState; claim: Claim }) {
  const entries = [...(s.diaryByClaim.get(claim.id) ?? [])].sort(
    (a, b) => Number(a.completed) - Number(b.completed) || a.dueDate.localeCompare(b.dueDate),
  );
  const editable = canEditClaim(s, claim);

  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState(addDays(TODAY, 7));
  const [result, setResult] = useState<Result | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editNote, setEditNote] = useState("");
  const [editDue, setEditDue] = useState("");

  const pick = (c: string) => {
    setCode(c);
    if (c) {
      setNote(diaryLabel(c));
      setDue(defaultDueDate(c));
    }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = addDiary(claim.id, code, note, due);
    setResult(r);
    if (r.ok) {
      setCode("");
      setNote("");
      setDue(addDays(TODAY, 7));
    }
  };
  const startEdit = (d: DiaryEntry) => {
    setEditing(d.id);
    setEditNote(d.note);
    setEditDue(d.dueDate);
  };
  const saveEdit = (id: string) => {
    const r = updateDiary(id, editNote, editDue);
    setResult(r);
    if (r.ok) setEditing(null);
  };

  return (
    <div className="space-y-4">
      <ResultMessage result={result} />

      {editable && (
        <Card title="Add a diary entry">
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col">
              <label htmlFor="diary-code" className={labelCls}>
                Standard entry (quick pick)
              </label>
              <select id="diary-code" className={inputCls} value={code} onChange={(e) => pick(e.target.value)}>
                <option value="">Custom note…</option>
                {DIARY_CODES.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label} ({d.days} days)
                  </option>
                ))}
              </select>
            </div>
            <div className="flex min-w-72 flex-1 flex-col">
              <label htmlFor="diary-note" className={labelCls}>
                Note
              </label>
              <input id="diary-note" className={inputCls} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <div className="flex flex-col">
              <label htmlFor="diary-due" className={labelCls}>
                Due date
              </label>
              <input id="diary-due" type="date" className={inputCls} value={due} min={TODAY} onChange={(e) => setDue(e.target.value)} />
            </div>
            <button type="submit" className={btnPrimary} disabled={!note.trim()}>
              Add entry
            </button>
          </form>
        </Card>
      )}

      <Card title="Diary entries">
        {entries.length === 0 ? (
          <p className="text-sm text-slate-600">No diary entries on this claim.</p>
        ) : (
          <table className={tableCls}>
            <thead className={theadCls}>
              <tr>
                <th className={th}>Due</th>
                <th className={th}>Entry</th>
                <th className={th}>Owner</th>
                <th className={th}>Status</th>
                <th className={th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((d) => {
                const mine = d.ownerId === s.user.id;
                const overdue = !d.completed && d.dueDate < TODAY;
                return (
                  <tr key={d.id} className={rowCls}>
                    <td className={`${td} whitespace-nowrap`}>
                      {editing === d.id ? (
                        <>
                          <label htmlFor={`ed-due-${d.id}`} className="sr-only">
                            Due date
                          </label>
                          <input id={`ed-due-${d.id}`} type="date" className={inputCls} value={editDue} onChange={(e) => setEditDue(e.target.value)} />
                        </>
                      ) : (
                        fmtDate(d.dueDate)
                      )}
                    </td>
                    <td className={td}>
                      {editing === d.id ? (
                        <>
                          <label htmlFor={`ed-note-${d.id}`} className="sr-only">
                            Note
                          </label>
                          <input id={`ed-note-${d.id}`} className={`${inputCls} w-full`} value={editNote} onChange={(e) => setEditNote(e.target.value)} />
                        </>
                      ) : (
                        d.note
                      )}
                    </td>
                    <td className={td}>{userName(d.ownerId)}</td>
                    <td className={td}>
                      {d.completed ? (
                        <span className="text-slate-600">Done</span>
                      ) : overdue ? (
                        <span className="font-semibold text-red-800">Overdue {daysBetween(d.dueDate, TODAY)} days</span>
                      ) : (
                        <span className="text-slate-800">Upcoming</span>
                      )}
                    </td>
                    <td className={td}>
                      {d.completed ? null : !mine ? (
                        <span className="text-xs text-slate-600" title="Only the owner can change this entry">
                          <span aria-hidden="true">🔒 </span>Locked — owned by {userName(d.ownerId)}
                        </span>
                      ) : editing === d.id ? (
                        <div className="flex gap-1">
                          <button type="button" className={btnPrimary} onClick={() => saveEdit(d.id)}>
                            Save
                          </button>
                          <button type="button" className={btnSecondary} onClick={() => setEditing(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <button type="button" className={btnSecondary} onClick={() => setResult(completeDiary(d.id))}>
                            Mark done
                          </button>
                          <button type="button" className={btnSecondary} onClick={() => startEdit(d)}>
                            Edit
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
