/*
L3 FORMULA PROCESSOR
SPDX-License-Identifier: GPL-2.0-only
*/

import { readFileSync } from "node:fs";
import { extname } from "node:path";


// ---------- Constants ----------

const error = "\x1b[31merror!\x1b[0m"


// ---------- Helpers -----------

function panic(message: string): never
{
    console.error(message);
    process.exit(1);
}


// ---------- CLI Parsing ----------

let input = process.argv[2];

if (!input) {
    panic(error + " no arithmetic expression given\nUsage: node l3.ts <expr>");
}


// ---------- File Reading ----------

let source = "", enablePrinting = true;

try {
    source = readFileSync(input, 'utf-8');
    
    if (extname(input) !== ".l3")
        panic(error + " file extension not .l3, skipping...");

    enablePrinting = false;
}
catch (err) {
    source = input;
}


// ---------- Expressions ----------

type TokenType =
    | "integer"
    | "operator"
    | "relation"
    | "leftParen"
    | "rightParen"
    | "eof";

interface Token {
    type: TokenType;
    value: string;
}

type Expr =
    | { kind: "integer"; value: bigint }
    | { kind: "binary";
            op: "+" | "-" | "*" | "/";
            left: Expr;
            right: Expr; }
    | { kind: "relational"; expressions: Expr[] };



// ---------- Lexing ----------

const WSP = /\s/;
const DIGIT = /[0-9]/;
const OP = "+-*/";
const REL = "=";


function tokenize(source: string): Token[]
{
    const tokens: Token[] = [];

    for (let i = 0; i < source.length;) {
        const char = source[i];

        if (WSP.test(char)) { i++; continue; }


        if (DIGIT.test(char)) {
            let number = "";

            while (i < source.length && DIGIT.test(source[i])) {
                number += source[i++];
            }

            tokens.push({ type: "integer", value: number });
            continue;
        }


        if (OP.includes(char)) {
            tokens.push({ type: "operator", value: char });
            i++; continue;
        }

        if (REL.includes(char)) {
            tokens.push({ type: "relation", value: char });
            i++; continue;
        }


        if (char === "(") {
            tokens.push({ type: "leftParen", value: char });
            i++; continue;
        }
        if (char === ")") {
            tokens.push({ type: "rightParen", value: char });
            i++; continue;
        }


        // .slice() stops before i+2, meaning it gets i+1
        throw new Error(`${error} unexpected character: ${char} at ${source.slice(i-1, i+2)}`);
    }

    tokens.push({ type: "eof", value: "" });
    return tokens;
}


// ---------- Parser ----------

// TODO: renaming
class Parser
{
    private position = 0;

    constructor(private tokens: Token[]) {}

    private current(): Token {
        return this.tokens[this.position];
    }

    private consume(): Token {
        return this.tokens[this.position++];
    }

    private expect(value: string): void {
        if (this.current().value !== value) {
            throw new Error(`${error} expected '${value}', got '${this.current().value}' at position ${this.position}`);
        }

        this.consume();
    }

    parse(): Expr {
        const expressions: Expr[] = [this.parseArithmetic()];

        while (this.current().value === "=") {
            this.consume();
            expressions.push(this.parseArithmetic());
        }

        if (this.current().type !== "eof") {
            throw new Error(`${error} unexpected token: ${this.current().value}`);
        }

        if (expressions.length === 1) {
            return expressions[0];
        }

        return { kind: "relational", expressions };
    }

    private parseArithmetic(): Expr {
        let left = this.parseTerm();

        while (
            this.current().value === "+" ||
            this.current().value === "-"
        ) {
            const op = this.consume().value as "+" | "-";
            const right = this.parseTerm();

            left = { kind: "binary", op, left, right };
        }

        return left;
    }

    private parseTerm(): Expr {
        let left = this.parseFactor();

        while (
            this.current().value === "*" ||
            this.current().value === "/"
        ) {
            const op = this.consume().value as "*" | "/";
            const right = this.parseFactor();

            left = { kind: "binary", op, left, right };
        }

        return left;
    }

    private parseFactor(): Expr {
        const token = this.current();

        if (token.type === "integer") {
            this.consume();
            return { kind: "integer", value: BigInt(token.value) };
        }

        if (token.type === "leftParen") {
            this.consume();
            const expression = this.parseArithmetic();
            this.expect(")");
            return expression;
        }

        throw new Error(`${error} expected an integer or parentheses, got '${token.value}' at position ${this.position}`);
    }
}


// ---------- Evaluator ----------

function evaluate(expr: Expr): bigint | boolean
{
    switch (expr.kind) {
        case "integer":
            return expr.value;

        case "binary": {
            const left = evaluate(expr.left);
            const right = evaluate(expr.right);

            // Errors are unreachable, but narrow expressions to type bigint
            if (typeof left !== "bigint")
                throw new Error(`${error} expected integer operands (at '${left}')`);
            else if (typeof right !== "bigint")
                throw new Error(`${error} expected integer operands (at '${right}'`);

            switch (expr.op) {
                case "+": return left + right;
                case "-": return left - right;
                case "*": return left * right;

                case "/":
                    if (right === 0n)
                        throw new Error(`${error} division by zero (at '${left}/${right}')`);

                    if (left % right !== 0n)
                        throw new Error(`${error} division does not produce an integer`);

                    return left / right;
            }
        }

        case "relational": {
            const values = expr.expressions.map(evaluate);

            // function (value) { return value === values[0] }
            // vvvvvv  same thing
            return values.every(value => value === values[0]);
        }
    }
}


// ---------- Entry Point ----------

function main(source: string): void
{
    try {
        const tokens = tokenize(source);
        const parser = new Parser(tokens);
        const expression = parser.parse();

        const result = evaluate(expression);

        if (enablePrinting) console.log(source);
        console.log(result === true ? "\x1b[42;30mValid\x1b[0m" : result === false ? "\x1b[41mInvalid\x1b[0m" : result.toString());
    }
    catch (error) {
        console.error(
            error instanceof Error ? error.message : error
        );
    }
}

main(source);
