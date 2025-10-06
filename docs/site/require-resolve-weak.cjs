const Module = require('module');

if (!Module.__acmResolveWeakPatched) {
  const originalCompile = Module.Module.prototype._compile;
  Module.Module.prototype._compile = function patchedCompile(content, filename) {
    const prefix = 'if (typeof require.resolveWeak !== "function") { const fallback = typeof require.resolve === "function" ? require.resolve : (id) => id; require.resolveWeak = fallback; }\n';
    if (!content.startsWith('if (typeof require.resolveWeak')) {
      content = prefix + content;
    }
    return originalCompile.call(this, content, filename);
  };
  Module.__acmResolveWeakPatched = true;
}
