import { MappedString, AnnotatedParse, JSONValue } from "./imports";
import { Parser, Node, Language } from "web-tree-sitter";
import { data } from "./autogen/tree-sitter-json-data";

const ensureParser = (() => {
  let _parser: Parser | null = null;

  return async (): Promise<Parser> => {
    if (_parser) return _parser;
    await Parser.init();
    _parser = new Parser();
    const language = await Language.load(data);
    _parser.setLanguage(language);
    return _parser;
  }
})();

const convertToAnnotatedParse = (tree: Node, source: MappedString): AnnotatedParse => {
  const convertLiteral = (node: Node, kind: string): AnnotatedParse => {
    return {
      start: node.startIndex,
      end: node.endIndex,
      result: JSON.parse(node.text),
      kind,
      source,
      components: [],
    };
  };
  const convertNumber = (node: Node) => convertLiteral(node, "number");
  const convertBoolean = (node: Node) => convertLiteral(node, "boolean");
  const convertString = (node: Node) => convertLiteral(node, "string");
  const convertNull = (node: Node) => convertLiteral(node, "null");
  const convertArray = (node: Node): AnnotatedParse => {
    const components: AnnotatedParse[] = node.children
      .filter((child: Node | null) => child && !!dispatch[child.type])
      .map((child: Node | null) => convertToAnnotatedParse(child!, source));
    return {
      start: node.startIndex,
      end: node.endIndex,
      result: components.map(c => c.result),
      kind: "array",
      source,
      components,
    };
  }
  const convertObject = (node: Node): AnnotatedParse => {
    const components: AnnotatedParse[] = [];
    const result: JSONValue = {};
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child || child.type !== "pair") continue;
      const keyNode = convertToAnnotatedParse(child.child(0)!, source);
      const valueNode = convertToAnnotatedParse(child.child(2)!, source);
      components.push(keyNode, valueNode);
      result[keyNode.result as string] = valueNode.result;
    }
    return {
      start: node.startIndex,
      end: node.endIndex,
      result,
      kind: "object",
      source,
      components,
    };
  };
  const dispatch: Record<string, typeof convertNumber> = {
    "object": convertObject,
    "array": convertArray,
    "string": convertString,
    "number": convertNumber,
    "boolean": convertBoolean,
    "true": convertBoolean,
    "false": convertBoolean,
    "null": convertNull,
  };
  const type = tree.type;
  const convert = dispatch[type];
  if (!convert) {
    throw new Error(`Unsupported node type: ${type}`);
  }
  return convert(tree);
}

export const parse = async (jsonString: MappedString): Promise<AnnotatedParse> => {
  const parser = await ensureParser();
  const tree = parser.parse(jsonString.value);
  if (!tree) {
    throw new Error("Failed to parse JSON");
  }
  return convertToAnnotatedParse(tree.rootNode.child(0)!, jsonString);
}
