const path = require('path');

const SUPPORTED_LANGUAGES = new Set(['java', 'python', 'cpp', 'c', 'javascript', 'csharp']);

const normalizePath = (value) =>
  String(value || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '')
    .trim();

const normalizeLanguage = (language) => {
  const raw = String(language || '').trim().toLowerCase();
  const aliases = {
    'c++': 'cpp',
    js: 'javascript',
    node: 'javascript',
    py: 'python',
    cxx: 'cpp',
    cc: 'cpp',
    cs: 'csharp',
    'c#': 'csharp',
  };
  if (aliases[raw]) return aliases[raw];
  return raw;
};

const stripJavaComments = (source) =>
  String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const parseJavaDependencies = (content) => {
  const source = stripJavaComments(content);
  const imports = [];
  const referencedSimpleTypes = new Set();
  const declaredTypes = new Set();
  const pattern = /^\s*import\s+([\w$\.]+(?:\.\*)?)\s*;/gm;

  let match = pattern.exec(source);
  while (match) {
    const target = String(match[1] || '').trim();
    if (target && !target.startsWith('java.') && !target.startsWith('javax.') && !target.startsWith('jakarta.')) {
      imports.push(target);
    }
    match = pattern.exec(source);
  }

  const declarationPattern = /\b(?:class|interface|enum|record)\s+([A-Z][\w$]*)\b/g;
  let declarationMatch = declarationPattern.exec(source);
  while (declarationMatch) {
    declaredTypes.add(String(declarationMatch[1] || '').trim());
    declarationMatch = declarationPattern.exec(source);
  }

  const addTypeList = (value) => {
    String(value || '')
      .split(',')
      .map((item) => item.trim().replace(/<.*>/g, ''))
      .map((item) => item.split('.').pop())
      .map((item) => item.replace(/[^A-Za-z0-9_$]/g, ''))
      .forEach((item) => {
        if (item && /^[A-Z][\w$]*$/.test(item) && !declaredTypes.has(item)) {
          referencedSimpleTypes.add(item);
        }
      });
  };

  const newPattern = /\bnew\s+([A-Z][\w$]*)\s*\(/g;
  let newMatch = newPattern.exec(source);
  while (newMatch) {
    addTypeList(newMatch[1]);
    newMatch = newPattern.exec(source);
  }

  const extendsPattern = /\bextends\s+([A-Z][\w$]*)\b/g;
  let extendsMatch = extendsPattern.exec(source);
  while (extendsMatch) {
    addTypeList(extendsMatch[1]);
    extendsMatch = extendsPattern.exec(source);
  }

  const implementsPattern = /\bimplements\s+([^\{\n]+)/g;
  let implementsMatch = implementsPattern.exec(source);
  while (implementsMatch) {
    addTypeList(implementsMatch[1]);
    implementsMatch = implementsPattern.exec(source);
  }

  const staticRefPattern = /\b([A-Z][\w$]*)\s*\./g;
  let staticRefMatch = staticRefPattern.exec(source);
  while (staticRefMatch) {
    addTypeList(staticRefMatch[1]);
    staticRefMatch = staticRefPattern.exec(source);
  }

  return [...imports, ...Array.from(referencedSimpleTypes)];
};

const parsePythonDependencies = (content) => {
  const source = String(content || '');
  const dependencies = [];

  const importPattern = /^\s*import\s+(.+)$/gm;
  let importMatch = importPattern.exec(source);
  while (importMatch) {
    const entries = String(importMatch[1] || '')
      .split(',')
      .map((item) => item.trim().split(/\s+as\s+/i)[0])
      .filter(Boolean);
    dependencies.push(...entries);
    importMatch = importPattern.exec(source);
  }

  const fromPattern = /^\s*from\s+([\w\.]+)\s+import\s+(.+)$/gm;
  let fromMatch = fromPattern.exec(source);
  while (fromMatch) {
    const moduleName = String(fromMatch[1] || '').trim();
    const imported = String(fromMatch[2] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (moduleName) {
      dependencies.push(moduleName);
    }

    imported.forEach((symbol) => {
      const cleaned = symbol.split(/\s+as\s+/i)[0].trim();
      if (!cleaned || cleaned === '*') return;
      dependencies.push(`${moduleName}.${cleaned}`);
    });

    fromMatch = fromPattern.exec(source);
  }

  return dependencies;
};

const parseCppDependencies = (content) => {
  const source = String(content || '');
  const includes = [];
  const pattern = /^\s*#include\s+"([^"]+)"/gm;

  let match = pattern.exec(source);
  while (match) {
    const target = normalizePath(match[1]);
    if (target) includes.push(target);
    match = pattern.exec(source);
  }

  return includes;
};

const parseJavascriptDependencies = (content) => {
  const source = String(content || '');
  const dependencies = [];

  const importPattern = /\bimport\s+(?:[^'";]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  let importMatch = importPattern.exec(source);
  while (importMatch) {
    const target = String(importMatch[1] || '').trim();
    if (target && (target.startsWith('./') || target.startsWith('../'))) {
      dependencies.push(target);
    }
    importMatch = importPattern.exec(source);
  }

  const requirePattern = /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g;
  let requireMatch = requirePattern.exec(source);
  while (requireMatch) {
    const target = String(requireMatch[1] || '').trim();
    if (target && (target.startsWith('./') || target.startsWith('../'))) {
      dependencies.push(target);
    }
    requireMatch = requirePattern.exec(source);
  }

  return dependencies;
};

const stripCsharpComments = (source) =>
  String(source || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');

const parseCsharpDependencies = (content) => {
  const source = stripCsharpComments(content);
  const dependencies = [];
  const declaredTypes = new Set();

  const declarationPattern = /\b(?:class|interface|enum|struct|record)\s+([A-Z][\w]*)\b/g;
  let declarationMatch = declarationPattern.exec(source);
  while (declarationMatch) {
    declaredTypes.add(String(declarationMatch[1] || '').trim());
    declarationMatch = declarationPattern.exec(source);
  }

  const usingPattern = /^\s*using\s+([A-Za-z_][\w\.]+)\s*;/gm;
  let usingMatch = usingPattern.exec(source);
  while (usingMatch) {
    const target = String(usingMatch[1] || '').trim();
    if (target && !target.startsWith('System')) {
      dependencies.push(target);
    }
    usingMatch = usingPattern.exec(source);
  }

  const newPattern = /\bnew\s+([A-Z][\w]*)\s*\(/g;
  let newMatch = newPattern.exec(source);
  while (newMatch) {
    const typeName = String(newMatch[1] || '').trim();
    if (typeName && !declaredTypes.has(typeName)) {
      dependencies.push(typeName);
    }
    newMatch = newPattern.exec(source);
  }

  return dependencies;
};

const parseDependencies = (language, content) => {
  const normalizedLanguage = normalizeLanguage(language);

  if (normalizedLanguage === 'java') {
    return parseJavaDependencies(content);
  }

  if (normalizedLanguage === 'python') {
    return parsePythonDependencies(content);
  }

  if (normalizedLanguage === 'cpp' || normalizedLanguage === 'c') {
    return parseCppDependencies(content);
  }

  if (normalizedLanguage === 'javascript') {
    return parseJavascriptDependencies(content);
  }

  if (normalizedLanguage === 'csharp') {
    return parseCsharpDependencies(content);
  }

  return [];
};

const findEntryFile = (files, entryFileName, activeCode) => {
  const normalizedEntry = normalizePath(entryFileName);
  const normalizedFiles = files.map((file) => ({
    name: normalizePath(file.name),
    content: String(file.content || ''),
    original: file,
  }));

  if (normalizedEntry) {
    const exact = normalizedFiles.find((file) => file.name === normalizedEntry);
    if (exact) return exact;

    const byBase = normalizedFiles.find((file) => path.posix.basename(file.name) === path.posix.basename(normalizedEntry));
    if (byBase) return byBase;
  }

  if (activeCode) {
    const byCode = normalizedFiles.find((file) => file.content === String(activeCode || ''));
    if (byCode) return byCode;
  }

  return normalizedFiles[0] || null;
};

const buildIndexes = (files) => {
  const byPath = new Map();
  const byBase = new Map();

  files.forEach((file) => {
    byPath.set(file.name, file);
    const base = path.posix.basename(file.name);
    if (!byBase.has(base)) {
      byBase.set(base, []);
    }
    byBase.get(base).push(file);
  });

  return { byPath, byBase };
};

const resolveJavaDependency = (dep, currentFilePath, indexes) => {
  const results = [];
  const raw = String(dep || '').trim();
  if (!raw) return results;

  const currentDir = path.posix.dirname(currentFilePath || '');

  if (!raw.includes('.')) {
    const simpleName = raw.replace(/[^A-Za-z0-9_$]/g, '');
    if (!simpleName) return results;

    const sameDirCandidate = normalizePath(path.posix.join(currentDir, `${simpleName}.java`));
    if (indexes.byPath.has(sameDirCandidate)) {
      results.push(indexes.byPath.get(sameDirCandidate));
    }

    const base = `${simpleName}.java`;
    (indexes.byBase.get(base) || []).forEach((file) => results.push(file));
    return dedupeByPath(results);
  }

  const isWildcard = raw.endsWith('.*');
  const modulePath = raw.replace(/\.\*$/, '').replace(/\./g, '/');

  if (isWildcard) {
    indexes.byPath.forEach((file) => {
      if (file.name.startsWith(`${modulePath}/`) && file.name.endsWith('.java')) {
        results.push(file);
      }
    });
    return results;
  }

  const directPath = `${modulePath}.java`;
  if (indexes.byPath.has(directPath)) {
    results.push(indexes.byPath.get(directPath));
    return results;
  }

  const base = `${path.posix.basename(modulePath)}.java`;
  (indexes.byBase.get(base) || []).forEach((file) => results.push(file));
  return results;
};

const resolvePythonDependency = (dep, indexes) => {
  const results = [];
  const raw = String(dep || '').trim();
  if (!raw) return results;

  const modulePath = raw.replace(/\./g, '/');
  const candidates = [
    `${modulePath}.py`,
    `${modulePath}/__init__.py`,
    `${path.posix.basename(modulePath)}.py`,
  ];

  candidates.forEach((candidate) => {
    const hit = indexes.byPath.get(normalizePath(candidate));
    if (hit) results.push(hit);
  });

  return results;
};

const resolveCppDependency = (dep, currentFilePath, indexes, language) => {
  const results = [];
  const includeTarget = normalizePath(dep);
  if (!includeTarget) return results;

  const currentDir = path.posix.dirname(currentFilePath || '');
  const directCandidates = [
    normalizePath(path.posix.join(currentDir, includeTarget)),
    includeTarget,
    path.posix.basename(includeTarget),
  ];

  directCandidates.forEach((candidate) => {
    const direct = indexes.byPath.get(candidate);
    if (direct) results.push(direct);

    if (!direct) {
      const matches = indexes.byBase.get(path.posix.basename(candidate)) || [];
      matches.forEach((file) => results.push(file));
    }
  });

  // If a header is included, include sibling source file with same base name.
  const ext = path.posix.extname(includeTarget).toLowerCase();
  if (ext === '.h' || ext === '.hpp') {
    const base = path.posix.basename(includeTarget, ext);
    const siblingExtensions = language === 'c' ? ['.c'] : ['.cpp', '.cc', '.cxx', '.c'];
    siblingExtensions.forEach((siblingExt) => {
      const siblingName = `${base}${siblingExt}`;
      const siblingByBase = indexes.byBase.get(siblingName) || [];
      siblingByBase.forEach((file) => results.push(file));
    });
  }

  return results;
};

const resolveJavascriptDependency = (dep, currentFilePath, indexes) => {
  const results = [];
  const target = String(dep || '').trim();
  if (!target) return results;

  const currentDir = path.posix.dirname(currentFilePath || '');
  const basePath = normalizePath(path.posix.join(currentDir, target));
  const candidates = [
    basePath,
    `${basePath}.js`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    normalizePath(path.posix.join(basePath, 'index.js')),
  ];

  candidates.forEach((candidate) => {
    const hit = indexes.byPath.get(candidate);
    if (hit) results.push(hit);
  });

  return dedupeByPath(results);
};

const resolveCsharpDependency = (dep, currentFilePath, indexes) => {
  const results = [];
  const raw = String(dep || '').trim();
  if (!raw) return results;

  const currentDir = path.posix.dirname(currentFilePath || '');
  const simpleName = raw.includes('.') ? raw.split('.').pop() : raw;
  const sanitized = simpleName.replace(/[^A-Za-z0-9_]/g, '');
  if (!sanitized) return results;

  const sameDirCandidate = normalizePath(path.posix.join(currentDir, `${sanitized}.cs`));
  if (indexes.byPath.has(sameDirCandidate)) {
    results.push(indexes.byPath.get(sameDirCandidate));
  }

  const baseName = `${sanitized}.cs`;
  (indexes.byBase.get(baseName) || []).forEach((file) => results.push(file));
  return dedupeByPath(results);
};

const dedupeByPath = (files) => {
  const map = new Map();
  files.forEach((file) => {
    if (file && file.name && !map.has(file.name)) {
      map.set(file.name, file);
    }
  });
  return Array.from(map.values());
};

const collectRequiredFiles = ({ language, entryFile, files }) => {
  const normalizedLanguage = normalizeLanguage(language);
  if (!SUPPORTED_LANGUAGES.has(normalizedLanguage)) {
    return entryFile ? [entryFile] : [];
  }

  const indexes = buildIndexes(files);
  const visited = new Set();
  const collected = [];

  const visit = (file) => {
    if (!file || visited.has(file.name)) return;

    visited.add(file.name);
    collected.push(file);

    const dependencies = parseDependencies(normalizedLanguage, file.content);
    dependencies.forEach((dep) => {
      let resolved = [];
      if (normalizedLanguage === 'java') {
        resolved = resolveJavaDependency(dep, file.name, indexes);
      } else if (normalizedLanguage === 'python') {
        resolved = resolvePythonDependency(dep, indexes);
      } else if (normalizedLanguage === 'javascript') {
        resolved = resolveJavascriptDependency(dep, file.name, indexes);
      } else if (normalizedLanguage === 'csharp') {
        resolved = resolveCsharpDependency(dep, file.name, indexes);
      } else {
        resolved = resolveCppDependency(dep, file.name, indexes, normalizedLanguage);
      }

      dedupeByPath(resolved).forEach((nextFile) => visit(nextFile));
    });
  };

  visit(entryFile);
  return dedupeByPath(collected);
};

const collectRequiredExecutionFiles = ({ language, entryFileName, activeCode, files }) => {
  const normalizedFiles = (Array.isArray(files) ? files : [])
    .map((file) => ({
      name: normalizePath(file?.name),
      content: String(file?.content || ''),
    }))
    .filter((file) => file.name);

  if (!normalizedFiles.length) {
    return [];
  }

  const entryFile = findEntryFile(normalizedFiles, entryFileName, activeCode);
  if (!entryFile) {
    return [];
  }

  const required = collectRequiredFiles({
    language,
    entryFile,
    files: normalizedFiles,
  });

  return required.map((file) => ({ filename: file.name, content: file.content }));
};

module.exports = {
  parseJavaDependencies,
  parsePythonDependencies,
  parseCppDependencies,
  parseJavascriptDependencies,
  parseCsharpDependencies,
  parseDependencies,
  collectRequiredFiles,
  collectRequiredExecutionFiles,
};
