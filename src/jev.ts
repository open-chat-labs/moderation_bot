// Client for TypeSafe's Jev model. See https://docs.typesafe.ai/api
export const JEV_URL = "https://api.typesafe.ai/v1/systemone";
export const JEV_MODEL = "jev-latest";
const TIMEOUT_MS = 10_000;

export type JevState = {
    type: string;
    context: "main chat" | "thread";
    content?: string;
};

export type JevFailure =
    | { kind: "network" }
    | { kind: "timeout" }
    | { kind: "rate_limited" }
    | { kind: "bad_status"; status: number }
    | { kind: "missing_answer" };

export type JevResult =
    | { kind: "success"; model: string; scores: number[] }
    | { kind: "failure"; failure: JevFailure };

type NoulAnswer = { type: "noul"; noul: number };

// One noul question per rule, all in one call. Message content only ever goes in the state.
export async function askJev(
    state: JevState,
    rules: string[],
): Promise<JevResult> {
    const questions: Record<string, { type: "noul"; instructions: string }> =
        {};
    rules.forEach((rule, i) => {
        questions[`rule_${i}`] = {
            type: "noul",
            instructions: `Does this message break the following chat rule? Rule: ${rule}`,
        };
    });

    let resp: Response;
    try {
        resp = await fetch(JEV_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${process.env.TYPESAFE_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ state, model: JEV_MODEL, questions }),
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });
    } catch (err) {
        const timedOut = err instanceof Error && err.name === "TimeoutError";
        return fail(timedOut ? { kind: "timeout" } : { kind: "network" });
    }

    if (resp.status === 429) {
        return fail({ kind: "rate_limited" });
    }
    if (!resp.ok) {
        return fail({ kind: "bad_status", status: resp.status });
    }

    try {
        const body = (await resp.json()) as {
            model: string;
            answers: Record<string, NoulAnswer | undefined>;
        };
        const scores = rules.map((_, i) => body.answers[`rule_${i}`]?.noul);
        if (scores.some((s) => typeof s !== "number")) {
            return fail({ kind: "missing_answer" });
        }
        return { kind: "success", model: body.model, scores: scores as number[] };
    } catch {
        return fail({ kind: "missing_answer" });
    }
}

// Logs only the failure kind and status. Never the request, which carries the API key.
function fail(failure: JevFailure): JevResult {
    console.error("TypeSafe request failed:", JSON.stringify(failure));
    return { kind: "failure", failure };
}
