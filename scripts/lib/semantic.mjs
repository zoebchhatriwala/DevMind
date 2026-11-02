import { optionalPackage } from './runtime.mjs';

export function loadParser(root, toolingRoot) {
  const installed = optionalPackage(toolingRoot ?? root, ['typescript']);
  if (!installed) return null;
  const ts = installed.module;
  if (typeof ts.createSourceFile !== 'function' || typeof ts.forEachChild !== 'function') return null;
  return ts;
}

export function analyzeSource(ts, file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const findings = [];
  function add(id, node, message, fix) {
    findings.push({ id, offset: node.getStart(tree), message, fix });
  }
  function empty(node) {
    return ts.isBlock(node) && node.statements.length === 0;
  }
  function property(node, name) {
    return ts.isPropertyAccessExpression(node) && node.name.text === name;
  }
  function visit(node) {
    if (ts.isCatchClause(node) && empty(node.block)) add('FLOW-007', node, 'Empty catch block discards the failure.', 'Recover explicitly or propagate a safe error.');
    if (ts.isCallExpression(node) && property(node.expression, 'catch')) {
      const handler = node.arguments[0];
      if (handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) && empty(handler.body)) {
        add('FLOW-007', node, 'Promise rejection handler discards the failure.', 'Handle or propagate the rejected operation.');
      }
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) add('CODE-014', node, 'Explicit any bypasses type checking.', 'Use a domain type or unknown with boundary validation.');
    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(tree);
      if (name === 'href' && node.initializer && ts.isStringLiteral(node.initializer) && ['#', 'javascript:void(0)'].includes(node.initializer.text)) {
        add('FLOW-008', node, 'Link has a placeholder destination.', 'Use a real destination or a working button.');
      }
      if (['onClick', 'onSubmit'].includes(name) && node.initializer && ts.isJsxExpression(node.initializer)) {
        const handler = node.initializer.expression;
        if (handler && ts.isArrowFunction(handler) && (empty(handler.body) || (ts.isIdentifier(handler.body) && handler.body.text === 'undefined') || ts.isVoidExpression(handler.body))) {
          // void save() still performs work; only void literals are a no-op.
          if (!ts.isVoidExpression(handler.body) || ts.isNumericLiteral(handler.body.expression)) {
            add('FLOW-008', node, 'Interaction handler does no work.', 'Implement the visible outcome and recovery path.');
          }
        }
      }
    }
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(tree);
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute).map(attr => attr.name.getText(tree));
      if (name === 'img' && !attrs.includes('alt')) add('FE-012', node, 'Image may be missing alternative text.', 'Provide alt text or inspect spread props.');
      if (['div', 'span'].includes(name) && attrs.includes('onClick')) add('FE-013', node, 'Clickable non-semantic element needs accessibility review.', 'Prefer native button or anchor semantics.');
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  for (const diagnostic of tree.parseDiagnostics) {
    findings.push({ id: 'CODE-017', offset: diagnostic.start ?? 0, message: `Parser syntax diagnostic ${diagnostic.code}.`, fix: 'Run the project type checker to inspect the syntax error.' });
  }
  return findings;
}
