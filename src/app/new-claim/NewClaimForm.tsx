"use client";
// New claim intake with "Start from a report" [3.3, 3.4G, 3.16].
// AI is advisory: suggestions fill the form and are visibly marked; nothing saves until a person clicks Save.
import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";
import { Card, Loading, PageTitle, ResultMessage, btnPrimary, btnSecondary, inputCls, labelCls } from "@/components/ui";
import { canCreateClaims, createClaim, validateNewClaim, type NewClaimInput, type Result } from "@/lib/actions";
import { BODY_PARTS, CAUSES, DAMAGE_TYPES, DEPARTMENTS } from "@/lib/codes";
import { TODAY } from "@/lib/dates";
import { EXTRACT_KEYS, type ExtractKey, type ExtractResponse, type Suggestion } from "@/lib/intake";
import { SAMPLE_REPORTS } from "@/lib/intakeSamples";
import { useAppState } from "@/lib/store";
import { USERS, isAdjuster } from "@/lib/users";

type Values = NewClaimInput;

// Where the current suggestions came from, so badges say "AI suggestion" only when Claude produced them.
const SuggestionSource = createContext<"ai" | "offline">("ai");
type Errors = Partial<Record<keyof Values, string>>;

const EMPTY: Values = {
  type: "",
  claimantName: "",
  department: "",
  dateOfLoss: "",
  dateReported: TODAY,
  cause: "",
  bodyPartOrDamage: "",
  description: "",
  adjusterId: "",
};

/** Default adjuster for a claim type: yourself if you're an adjuster of that type, else the first one. */
function defaultAdjuster(type: string, userId: string) {
  const role = type === "GL" ? "adjuster_gl" : type === "WC" ? "adjuster_wc" : null;
  if (!role) return "";
  const me = USERS.find((u) => u.id === userId && u.role === role);
  return me?.id ?? USERS.find((u) => u.role === role)?.id ?? "";
}

export default function NewClaimForm() {
  const s = useAppState();
  const router = useRouter();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [report, setReport] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [extraction, setExtraction] = useState<ExtractResponse | null>(null);
  const [message, setMessage] = useState<Result | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (!s) return <Loading />;
  const allowed = canCreateClaims(s.role);
  const suggestions = extraction?.fields ?? {};

  const set = (k: keyof Values, v: string) => {
    const next = { ...values, [k]: v };
    if (k === "type") {
      // Coded fields depend on the claim type; clear values that no longer fit.
      if (!CAUSES.some((c) => c.code === next.cause && c.type === v)) next.cause = "";
      const list = v === "GL" ? DAMAGE_TYPES : BODY_PARTS;
      if (!list.some((b) => b.code === next.bodyPartOrDamage)) next.bodyPartOrDamage = "";
      next.adjusterId = defaultAdjuster(v, s.user.id);
    }
    setValues(next);
    if (submitted) setErrors(validateNewClaim(next));
  };

  const extract = async () => {
    setExtracting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/extract", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: report }) });
      const data = (await res.json()) as ExtractResponse & { error?: string };
      if (!res.ok || data.error) {
        setMessage({ ok: false, error: data.error ?? `Extraction failed (${res.status}).` });
        return;
      }
      setExtraction(data);
      setValues((prev) => {
        const next = { ...prev };
        for (const k of EXTRACT_KEYS) if (data.fields[k]) next[k] = data.fields[k]!.value;
        if (data.fields.type) next.adjusterId = defaultAdjuster(data.fields.type.value, s.user.id);
        return next;
      });
    } catch {
      setMessage({ ok: false, error: "Could not reach the extraction service. Fill in the form manually." });
    } finally {
      setExtracting(false);
    }
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validateNewClaim(values);
    setErrors(errs);
    if (Object.keys(errs).length) {
      setMessage({ ok: false, error: `Please fix ${Object.keys(errs).length} field(s) before saving.` });
      return;
    }
    const suggested: Partial<Record<ExtractKey, string>> = {};
    for (const k of EXTRACT_KEYS) if (suggestions[k]) suggested[k] = suggestions[k]!.value;
    const r = createClaim(values, extraction ? { source: extraction.source, model: extraction.model, suggested } : undefined);
    setMessage(r);
    if (r.ok && r.claimId) router.push(`/claims/${r.claimId}?created=1`);
  };

  const causes = CAUSES.filter((c) => !values.type || c.type === values.type);
  const bodyList = values.type === "GL" ? DAMAGE_TYPES : values.type === "WC" ? BODY_PARTS : [];
  const adjusters = USERS.filter((u) => (values.type === "GL" ? u.role === "adjuster_gl" : values.type === "WC" ? u.role === "adjuster_wc" : isAdjuster(u.role)));
  const aiCount = Object.keys(suggestions).length;
  const pendingReview = EXTRACT_KEYS.filter((k) => suggestions[k] && suggestions[k]!.value === values[k]).length;

  return (
    <div className="space-y-5">
      <PageTitle title="New Claim" subtitle="Enter a new workers' compensation or general liability claim, or start from a report and review the suggested fields." />

      {!allowed && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <strong>View only.</strong> Read-only staff can&apos;t create claims. Switch roles in the header to enter a claim.
        </p>
      )}

      <SuggestionSource.Provider value={extraction?.source ?? "ai"}>
        <div className="grid gap-5 xl:grid-cols-5">
          <div className="xl:col-span-2">
            <Card title="Start from a report (optional)">
              <p className="mb-2 text-sm text-slate-700">
                Paste the text of a first report of injury or an incident report, or choose a sample. The form will be pre-filled for you to review.
              </p>
              <fieldset className="mb-3">
                <legend className={labelCls}>Sample reports (fictional)</legend>
                <div className="mt-1 flex flex-col gap-1">
                  {SAMPLE_REPORTS.map((r) => (
                    <button key={r.id} type="button" className={`${btnSecondary} text-left`} onClick={() => setReport(r.text)} disabled={!allowed}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label htmlFor="report" className={labelCls}>
                Report text
              </label>
              <textarea
                id="report"
                rows={14}
                className={`${inputCls} w-full font-mono text-xs`}
                value={report}
                onChange={(e) => setReport(e.target.value)}
                disabled={!allowed}
              />
              <div className="mt-2 flex items-center gap-3">
                <button type="button" className={btnPrimary} onClick={extract} disabled={!allowed || extracting || !report.trim()}>
                  {extracting ? "Reading report…" : "Fill form from report"}
                </button>
                {report && (
                  <button type="button" className={btnSecondary} onClick={() => setReport("")}>
                    Clear
                  </button>
                )}
              </div>
              {extraction && (
                <div
                  role="status"
                  className={`mt-3 rounded border px-3 py-2 text-sm ${
                    extraction.source === "ai" ? "border-violet-300 bg-violet-50 text-violet-950" : "border-slate-300 bg-slate-50 text-slate-800"
                  }`}
                >
                  {extraction.source === "ai" ? (
                    <>
                      <strong>AI suggested {aiCount} field(s)</strong> using {extraction.model}. Review each highlighted field before saving.
                    </>
                  ) : (
                    <>
                      <strong>Offline extraction.</strong> {extraction.reason} A simple rule-based parser filled {aiCount} field(s); review them carefully.
                    </>
                  )}
                  {extraction.warnings.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {extraction.warnings.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </div>

          <form onSubmit={save} noValidate className="space-y-4 xl:col-span-3" aria-describedby="form-status">
            <Card title="Claim details">
              <div id="form-status">
                <ResultMessage result={message} />
              </div>
              {aiCount > 0 && pendingReview > 0 && (
                <p className="mb-3 text-sm text-amber-900">
                  {pendingReview} field(s) still show an unreviewed suggestion. Check them against the report; you can change any value.
                </p>
              )}
              <fieldset disabled={!allowed} className="grid gap-4 md:grid-cols-2">
                <legend className="sr-only">Claim details</legend>
                <Field k="type" label="Claim type" required errors={errors} suggestion={suggestions.type} value={values.type}>
                  <select id="f-type" className={`${inputCls} w-full`} value={values.type} onChange={(e) => set("type", e.target.value)} {...aria("type", errors)}>
                    <option value="">Choose…</option>
                    <option value="WC">Workers&apos; compensation (WC)</option>
                    <option value="GL">General liability (GL)</option>
                  </select>
                </Field>
                <Field k="claimantName" label="Claimant" required errors={errors} suggestion={suggestions.claimantName} value={values.claimantName}>
                  <input id="f-claimantName" className={`${inputCls} w-full`} value={values.claimantName} onChange={(e) => set("claimantName", e.target.value)} {...aria("claimantName", errors)} />
                </Field>
                <Field k="department" label="Department" required errors={errors} suggestion={suggestions.department} value={values.department}>
                  <select id="f-department" className={`${inputCls} w-full`} value={values.department} onChange={(e) => set("department", e.target.value)} {...aria("department", errors)}>
                    <option value="">Choose…</option>
                    {DEPARTMENTS.map((d) => (
                      <option key={d.code} value={d.code}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field k="adjusterId" label="Assigned adjuster" required errors={errors} value={values.adjusterId}>
                  <select id="f-adjusterId" className={`${inputCls} w-full`} value={values.adjusterId} onChange={(e) => set("adjusterId", e.target.value)} {...aria("adjusterId", errors)}>
                    <option value="">{values.type ? "Choose…" : "Choose a claim type first"}</option>
                    {adjusters.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.title})
                      </option>
                    ))}
                  </select>
                </Field>
                <Field k="dateOfLoss" label="Date of loss" required errors={errors} suggestion={suggestions.dateOfLoss} value={values.dateOfLoss}>
                  <input id="f-dateOfLoss" type="date" max={TODAY} className={`${inputCls} w-full`} value={values.dateOfLoss} onChange={(e) => set("dateOfLoss", e.target.value)} {...aria("dateOfLoss", errors)} />
                </Field>
                <Field k="dateReported" label="Date reported" required errors={errors} suggestion={suggestions.dateReported} value={values.dateReported}>
                  <input id="f-dateReported" type="date" max={TODAY} className={`${inputCls} w-full`} value={values.dateReported} onChange={(e) => set("dateReported", e.target.value)} {...aria("dateReported", errors)} />
                </Field>
                <Field k="cause" label="Cause" required errors={errors} suggestion={suggestions.cause} value={values.cause}>
                  <select id="f-cause" className={`${inputCls} w-full`} value={values.cause} onChange={(e) => set("cause", e.target.value)} {...aria("cause", errors)}>
                    <option value="">{values.type ? "Choose…" : "Choose a claim type first"}</option>
                    {causes.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  k="bodyPartOrDamage"
                  label={values.type === "GL" ? "Damage type" : "Body part"}
                  required
                  errors={errors}
                  suggestion={suggestions.bodyPartOrDamage}
                  value={values.bodyPartOrDamage}
                >
                  <select
                    id="f-bodyPartOrDamage"
                    className={`${inputCls} w-full`}
                    value={values.bodyPartOrDamage}
                    onChange={(e) => set("bodyPartOrDamage", e.target.value)}
                    {...aria("bodyPartOrDamage", errors)}
                  >
                    <option value="">{values.type ? "Choose…" : "Choose a claim type first"}</option>
                    {bodyList.map((b) => (
                      <option key={b.code} value={b.code}>
                        {b.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="md:col-span-2">
                  <Field k="description" label="Description" required errors={errors} suggestion={suggestions.description} value={values.description}>
                    <textarea id="f-description" rows={4} className={`${inputCls} w-full`} value={values.description} onChange={(e) => set("description", e.target.value)} {...aria("description", errors)} />
                  </Field>
                </div>
              </fieldset>
            </Card>
            {allowed && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="submit" className={btnPrimary}>
                  Save claim
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  onClick={() => {
                    setValues(EMPTY);
                    setErrors({});
                    setExtraction(null);
                    setMessage(null);
                    setSubmitted(false);
                  }}
                >
                  Start over
                </button>
                <span className="text-sm text-slate-600">Nothing is saved until you click Save claim.</span>
              </div>
            )}
          </form>
        </div>
      </SuggestionSource.Provider>
    </div>
  );
}

const aria = (k: keyof Values, errors: Errors) => ({
  "aria-invalid": errors[k] ? true : undefined,
  "aria-describedby": `f-${k}-help`,
  "aria-required": true,
});

const CONF_LABEL: Record<string, string> = { high: "high confidence", medium: "medium confidence", low: "low confidence" };

/** A labelled field. AI-suggested values are outlined and badged until the user changes them [3.16]. */
function Field({
  k,
  label,
  required,
  errors,
  suggestion,
  value,
  children,
}: {
  k: keyof Values;
  label: string;
  required?: boolean;
  errors: Errors;
  suggestion?: Suggestion;
  value: string;
  children: React.ReactNode;
}) {
  const source = useContext(SuggestionSource);
  const unreviewed = suggestion && suggestion.value === value;
  const edited = suggestion && suggestion.value !== value;
  return (
    <div className={`flex flex-col gap-1 rounded ${unreviewed ? "border-2 border-amber-400 bg-amber-50 p-2" : ""}`}>
      <label htmlFor={`f-${k}`} className={labelCls}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      <div id={`f-${k}-help`} className="text-xs">
        {unreviewed && (
          <span className="font-semibold text-amber-900">
            {source === "ai" ? "AI suggestion" : "Suggested from report (offline parser)"} — review before saving ({CONF_LABEL[suggestion.confidence]})
          </span>
        )}
        {edited && <span className="text-slate-600">Changed from the suggested value.</span>}
        {errors[k] && <span className="block font-semibold text-red-800">{errors[k]}</span>}
      </div>
    </div>
  );
}

