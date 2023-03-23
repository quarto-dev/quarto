import type Token from "markdown-it/lib/token"

export const toAst = (toks: Token[]) => {
    let pos = 0;
    const inner = () => {
        if (pos >= toks.length) return;
        const tok = toks[pos];
        if (tok.type.endsWith('_open')) {
            ++pos;
            const children: any[] = [];
            while (toks[pos].type !== tok.type.replace('_open', '_close')) {
                children.push(inner());
            }
            ++pos;
            return {
                ...tok,
                type: tok.type.replace('_open', ''),
                children: children
            } as Token;
        }
        if (tok.type === 'inline' && tok.children) {
            const children = toAst(tok.children);
            ++pos;
            return {
                ...tok,
                children
            } as Token;
        }
        ++pos;
        return tok;
    }
    const result: Token[] = [];
    while (pos < toks.length) {
        const node = inner();
        if (node) result.push(node);
    }
    return result;
};
