import Decimal from "decimal.js";

const ExactDecimal = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const MAX_EXPRESSION_LENGTH = 512;
const MAX_AST_DEPTH = 24;

type Token =
  | { kind: "num"; raw: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" }
  | { kind: "lparen" }
  | { kind: "rparen" };

function tokenize(expr: string): Token[] {
  if (expr.length === 0 || expr.length > MAX_EXPRESSION_LENGTH) {
    throw new Error(`Expression length must be between 1 and ${MAX_EXPRESSION_LENGTH} characters`);
  }
  const tokens: Token[] = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i]!;
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (ch === "(") {
      tokens.push({ kind: "lparen" });
      i++;
    } else if (ch === ")") {
      tokens.push({ kind: "rparen" });
      i++;
    } else if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ kind: "op", op: ch });
      i++;
    } else if (/[0-9.]/.test(ch)) {
      let start = i;
      let dots = 0;
      while (i < expr.length && /[0-9_.,]/.test(expr[i]!)) {
        if (expr[i] === ".") dots++;
        if (dots > 1) throw new Error("Malformed decimal literal");
        i++;
      }
      const cleaned = expr.slice(start, i).replace(/[,_]/g, "");
      if (!/^\d+(\.\d+)?$/.test(cleaned)) {
        throw new Error(`Invalid number literal: ${cleaned}`);
      }
      tokens.push({ kind: "num", raw: cleaned });
    } else {
      throw new Error(`Disallowed character '${ch}' in arithmetic expression`);
    }
  }
  return tokens;
}

/**
 * Bounded recursive-descent evaluator over 40-digit Decimal arithmetic.
 * Never invokes JavaScript eval() or IEEE-754 floating-point math.
 */
export function evaluateSafeDecimal(expression: string): string {
  const tokens = tokenize(expression);
  let pos = 0;

  function parseExpr(depth: number): Decimal {
    if (depth > MAX_AST_DEPTH) throw new Error("Maximum AST depth exceeded");
    let left = parseTerm(depth + 1);
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok?.kind === "op" && (tok.op === "+" || tok.op === "-")) {
        pos++;
        const right = parseTerm(depth + 1);
        left = tok.op === "+" ? left.plus(right) : left.minus(right);
      } else {
        break;
      }
    }
    return left;
  }

  function parseTerm(depth: number): Decimal {
    if (depth > MAX_AST_DEPTH) throw new Error("Maximum AST depth exceeded");
    let left = parseFactor(depth + 1);
    while (pos < tokens.length) {
      const tok = tokens[pos];
      if (tok?.kind === "op" && (tok.op === "*" || tok.op === "/")) {
        pos++;
        const right = parseFactor(depth + 1);
        if (tok.op === "/") {
          if (right.isZero()) throw new Error("Division by zero");
          left = left.div(right);
        } else {
          left = left.mul(right);
        }
      } else {
        break;
      }
    }
    return left;
  }

  function parseFactor(depth: number): Decimal {
    if (depth > MAX_AST_DEPTH) throw new Error("Maximum AST depth exceeded");
    const tok = tokens[pos];
    if (!tok) throw new Error("Unexpected end of expression");
    if (tok.kind === "op" && (tok.op === "+" || tok.op === "-")) {
      pos++;
      const inner = parseFactor(depth + 1);
      return tok.op === "-" ? inner.negated() : inner;
    }
    if (tok.kind === "lparen") {
      pos++;
      const val = parseExpr(depth + 1);
      if (tokens[pos]?.kind !== "rparen") throw new Error("Unclosed parenthesis");
      pos++;
      return val;
    }
    if (tok.kind === "num") {
      pos++;
      return new ExactDecimal(tok.raw);
    }
    throw new Error("Unexpected token in expression");
  }

  const result = parseExpr(0);
  if (pos !== tokens.length) {
    throw new Error("Trailing tokens after expression");
  }
  return result.toSignificantDigits(32).toString();
}

export interface PercentageClaimInput {
  initialValue: string;
  finalValue: string;
  claimedPercentChange: string;
  tolerancePctPoints?: string;
}

export interface PercentageClaimResult {
  computedPercentChange: string;
  claimedPercentChange: string;
  deltaPctPoints: string;
  outcome: "consistent" | "inconsistent";
}

export function evaluatePercentageClaim(input: PercentageClaimInput): PercentageClaimResult {
  const initial = new ExactDecimal(input.initialValue.replace(/[,_]/g, ""));
  const final = new ExactDecimal(input.finalValue.replace(/[,_]/g, ""));
  const claimed = new ExactDecimal(input.claimedPercentChange.replace(/[,_%]/g, ""));
  const tolerance = new ExactDecimal(input.tolerancePctPoints ?? "0.05");

  if (initial.isZero()) {
    throw new Error("Initial value cannot be zero when computing percentage change");
  }

  const computed = final.minus(initial).div(initial).mul(100);
  const delta = computed.minus(claimed).abs();

  return {
    computedPercentChange: computed.toSignificantDigits(16).toString(),
    claimedPercentChange: claimed.toString(),
    deltaPctPoints: delta.toSignificantDigits(16).toString(),
    outcome: delta.lte(tolerance) ? "consistent" : "inconsistent",
  };
}
