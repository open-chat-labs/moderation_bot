export type RuleSource = "community" | "channel" | "group";

export type Rule = {
    source: RuleSource;
    text: string;
};

export type BrokenRule = {
    rule: Rule;
    score: number;
};

export type Verdict =
    | { kind: "not_flagged" }
    | { kind: "flagged"; broken: BrokenRule[] };

// Leading list markers such as "1.", "2)", "-", "*" or "•"
const listMarker = /^(\d+[.)]|[-*•])\s*/;

// Turns the enabled rules texts (community first, then group or channel) into one rule per non-blank line
export function splitRules(
    texts: { source: RuleSource; text: string }[],
): Rule[] {
    return texts.flatMap(({ source, text }) =>
        text
            .split(/\r?\n/)
            .map((line) => line.trim().replace(listMarker, "").trim())
            .filter((line) => line !== "")
            .map((line) => ({ source, text: line })),
    );
}

export function verdict(
    rules: Rule[],
    scores: number[],
    threshold: number,
): Verdict {
    const broken: BrokenRule[] = [];
    rules.forEach((rule, i) => {
        if (scores[i] >= threshold) {
            broken.push({ rule, score: scores[i] });
        }
    });
    return broken.length > 0
        ? { kind: "flagged", broken }
        : { kind: "not_flagged" };
}

export function sourceLabel(source: RuleSource): string {
    return source.charAt(0).toUpperCase() + source.slice(1);
}

// e.g. It looks like this message broke the community rule "do not talk about dogs" (0.96 confidence)
export function describeBroken(broken: BrokenRule[]): string {
    const parts = broken.map(
        (b) =>
            `the ${b.rule.source} rule "${b.rule.text.replace(/[.!]+$/, "")}" (${b.score.toFixed(2)} confidence)`,
    );
    const list =
        parts.length === 1
            ? parts[0]
            : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
    return `It looks like this message broke ${list}`;
}
