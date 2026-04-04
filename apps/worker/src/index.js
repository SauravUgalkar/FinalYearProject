require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { exec, spawn } = require('child_process');
const http = require('http');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Initialize Redis (BullMQ requires ioredis)
const redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    const delayMs = Math.min(1000 * Math.pow(2, Math.min(times, 6)), 30000);
    if (times === 1) {
      console.warn('Redis not ready yet, retrying connection...');
    }
    return delayMs;
  },
  reconnectOnError: () => true,
});

let redisConnected = false;
let redisState = 'connecting';
redisClient.on('error', (err) => {
  redisState = 'error';
  console.error('Redis connection error:', err.message || err);
});
redisClient.on('connect', () => {
  redisConnected = true;
  redisState = 'connected';
  console.log('Redis connected');
});
redisClient.on('ready', () => {
  redisConnected = true;
  redisState = 'ready';
  console.log('Redis ready');
});
redisClient.on('reconnecting', () => {
  redisConnected = false;
  redisState = 'reconnecting';
  console.log('Redis reconnecting...');
});
redisClient.on('end', () => {
  redisConnected = false;
  redisState = 'ended';
  console.warn('Redis connection ended; waiting for reconnect');
});

const EXECUTION_DIR = '/tmp/code-execution';
const EXECUTION_TIMEOUT_MS = Number(process.env.EXECUTION_TIMEOUT_MS || 10000);
const MAX_CODE_CHARS = Number(process.env.MAX_CODE_CHARS || 200000);
const MAX_INPUT_CHARS = Number(process.env.MAX_INPUT_CHARS || 10000);
const MAX_FILES = Number(process.env.MAX_FILES || 50);
const MAX_FILE_NAME_CHARS = Number(process.env.MAX_FILE_NAME_CHARS || 255);
const MAX_FILE_CONTENT_CHARS = Number(process.env.MAX_FILE_CONTENT_CHARS || 200000);
const MAX_TOTAL_FILE_CHARS = Number(process.env.MAX_TOTAL_FILE_CHARS || 1000000);
const MAX_OUTPUT_CHARS = Number(process.env.MAX_OUTPUT_CHARS || 200000);
const ALLOWED_LANGUAGES = new Set(['javascript', 'python', 'java', 'c', 'cpp', 'csharp']);

const appendBoundedOutput = (current, chunk) => {
  const next = current + chunk;
  if (next.length <= MAX_OUTPUT_CHARS) return next;
  return `${next.slice(0, MAX_OUTPUT_CHARS)}\n[output truncated]`;
};

const sanitizeRelativeFilePath = (filePath) => {
  const normalized = String(filePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter((segment) => segment && segment !== '.' && segment !== '..');
  return segments.join('/');
};

const getJavaClassNameFromCode = (sourceCode) => {
  const code = String(sourceCode || '');
  const publicClassMatch = code.match(/public\s+class\s+([A-Za-z_$][\w$]*)/);
  if (publicClassMatch) return publicClassMatch[1];

  const classMatch = code.match(/class\s+([A-Za-z_$][\w$]*)/);
  return classMatch ? classMatch[1] : null;
};

const getJavaMainClassName = (files, entryFileName, fallbackClassName) => {
  const sanitizedEntry = sanitizeRelativeFilePath(entryFileName);
  const javaFiles = (files || []).filter((file) => String(file?.name || '').toLowerCase().endsWith('.java'));

  const fileWithMain = javaFiles.find((file) => /public\s+static\s+void\s+main\s*\(/.test(String(file.content || '')));
  if (fileWithMain) {
    return path.basename(sanitizeRelativeFilePath(fileWithMain.name), '.java');
  }

  const entryFile = javaFiles.find((file) => sanitizeRelativeFilePath(file.name) === sanitizedEntry);
  if (entryFile) {
    return path.basename(sanitizeRelativeFilePath(entryFile.name), '.java');
  }

  return fallbackClassName;
};

const writeExecutionFiles = async (tempDir, files) => {
  const writtenFiles = [];

  for (const file of files || []) {
    const relativePath = sanitizeRelativeFilePath(file?.name);
    if (!relativePath) continue;

    const absolutePath = path.join(tempDir, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, String(file?.content || ''));
    writtenFiles.push(absolutePath);
  }

  return writtenFiles;
};

const writeJavaExecutionFiles = async (tempDir, files) => {
  const seenFileNames = new Set();
  const writtenFiles = [];

  for (const file of files || []) {
    const sanitizedPath = sanitizeRelativeFilePath(file?.name);
    const baseName = path.basename(sanitizedPath);
    if (!baseName) continue;

    const normalizedBaseName = baseName.toLowerCase();
    if (seenFileNames.has(normalizedBaseName)) {
      throw new Error(`Duplicate Java file name detected: ${baseName}. Multi-file Java execution requires unique file names.`);
    }

    seenFileNames.add(normalizedBaseName);
    const absolutePath = path.join(tempDir, baseName);
    await fs.writeFile(absolutePath, String(file?.content || ''));
    writtenFiles.push(absolutePath);
  }

  return writtenFiles;
};

const getLanguageFromFileName = (fileName) => {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const mapping = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.py': 'python',
    '.java': 'java',
    '.c': 'c',
    '.cpp': 'cpp',
    '.cc': 'cpp',
    '.cxx': 'cpp',
    '.cs': 'csharp',
  };

  return mapping[ext] || null;
};

const normalizeExecutionLanguage = (language, files, entryFileName) => {
  const normalized = String(language || '').trim().toLowerCase();
  const aliases = {
    js: 'javascript',
    node: 'javascript',
    py: 'python',
    java: 'java',
    c: 'c',
    'c++': 'cpp',
    cxx: 'cpp',
    cc: 'cpp',
    cpp: 'cpp',
    cs: 'csharp',
    'c#': 'csharp',
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  const entryLanguage = getLanguageFromFileName(entryFileName);
  if (entryLanguage) {
    return entryLanguage;
  }

  const firstFileLanguage = (files || [])
    .map((file) => getLanguageFromFileName(file?.name))
    .find(Boolean);

  return firstFileLanguage || normalized || 'javascript';
};

const validateJobPayload = (data) => {
  const payload = data || {};
  const code = String(payload.code || '');
  const input = String(payload.input || '');
  const language = String(payload.language || '').trim();
  const entryFileName = sanitizeRelativeFilePath(payload.entryFileName || '');
  const filesInput = Array.isArray(payload.files) ? payload.files : [];

  if (code.length > MAX_CODE_CHARS) {
    throw new Error(`Code exceeds allowed size (${MAX_CODE_CHARS} chars).`);
  }

  if (input.length > MAX_INPUT_CHARS) {
    throw new Error(`Input exceeds allowed size (${MAX_INPUT_CHARS} chars).`);
  }

  if (filesInput.length > MAX_FILES) {
    throw new Error(`Too many files. Maximum allowed is ${MAX_FILES}.`);
  }

  let totalFileChars = 0;
  const files = filesInput.map((file) => {
    const name = sanitizeRelativeFilePath(file?.name || '');
    const content = String(file?.content || '');

    if (!name) {
      throw new Error('One or more files have an invalid name.');
    }

    if (name.length > MAX_FILE_NAME_CHARS) {
      throw new Error(`File name too long: ${name}`);
    }

    if (content.length > MAX_FILE_CONTENT_CHARS) {
      throw new Error(`File content too large for ${name}.`);
    }

    totalFileChars += content.length;
    return { name, content };
  });

  if (totalFileChars > MAX_TOTAL_FILE_CHARS) {
    throw new Error(`Total file content exceeds allowed size (${MAX_TOTAL_FILE_CHARS} chars).`);
  }

  const normalizedLanguage = normalizeExecutionLanguage(language, files, entryFileName);
  if (!ALLOWED_LANGUAGES.has(normalizedLanguage)) {
    throw new Error(`Unsupported language: ${normalizedLanguage}`);
  }

  return {
    code,
    input,
    files,
    language: normalizedLanguage,
    entryFileName,
  };
};

const execWithLimits = (command, options = {}) => {
  return execAsync(command, {
    cwd: options.cwd,
    timeout: EXECUTION_TIMEOUT_MS,
    maxBuffer: MAX_OUTPUT_CHARS,
  });
};

const runCommandWithInput = (command, args, input, timeout = EXECUTION_TIMEOUT_MS, options = {}) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeout,
      cwd: options.cwd,
      killSignal: 'SIGKILL',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout = appendBoundedOutput(stdout, data.toString());
    });

    proc.stderr.on('data', (data) => {
      stderr = appendBoundedOutput(stderr, data.toString());
    });

    proc.on('close', (code) => {
      resolve({ stdout, stderr, code });
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // Write input to stdin and close it
    if (input) {
      proc.stdin.write(input);
    }
    proc.stdin.end();
  });
};

// Find the best entry file from a list, preferring an exact name match, then default basename, then first file
const findEntryFile = (fileList, entryFileName, defaultBaseName) => {
  const sanitized = sanitizeRelativeFilePath(entryFileName || '');
  if (sanitized) {
    const exact = fileList.find((f) => sanitizeRelativeFilePath(f.name) === sanitized);
    if (exact) return exact;
  }
  if (defaultBaseName) {
    const byDefault = fileList.find((f) => path.basename(sanitizeRelativeFilePath(f.name)) === defaultBaseName);
    if (byDefault) return byDefault;
  }
  return fileList[0];
};

// Check if a filename ends with a given extension (case-insensitive)
const hasExt = (fname, ext) => String(fname || '').toLowerCase().endsWith(ext);

const buildExecutionLogs = (result = {}) => {
  const parts = [];
  if (result.output) {
    parts.push(`stdout:\n${result.output}`);
  }
  if (result.runtimeError) {
    parts.push(`stderr:\n${result.runtimeError}`);
  }
  if (result.compileError) {
    parts.push(`compileError:\n${result.compileError}`);
  }
  if (result.error && !result.runtimeError && !result.compileError) {
    parts.push(`error:\n${result.error}`);
  }
  return parts.join('\n\n').trim();
};

const worker = new Worker('code-execution', async (job) => {
  console.log(`Processing job ${job.id}...`);

  const payload = validateJobPayload(job.data);
  const { code, language, input, files, entryFileName } = payload;
  const executionLanguage = language;
  const jobId = job.id;
  const jobTag = `job_${jobId}`;

  const tempDir = path.join(EXECUTION_DIR, jobTag);
  const startedAt = Date.now();

  try {
    await fs.mkdir(tempDir, { recursive: true });

    // finalResult holds { status, output, compileError, runtimeError }
    let finalResult;

    switch (executionLanguage) {

      // -----------------------------------------------------------------------
      // JavaScript — interpreted, no compilation step
      // -----------------------------------------------------------------------
      case 'javascript': {
        const jsFiles = files.filter((f) => hasExt(f?.name, '.js'));
        let entryPath;

        if (jsFiles.length > 0) {
          await writeExecutionFiles(tempDir, jsFiles);
          const ef = findEntryFile(jsFiles, entryFileName, 'main.js');
          entryPath = path.join(tempDir, sanitizeRelativeFilePath(ef.name));
        } else {
          entryPath = path.join(tempDir, 'main.js');
          await fs.writeFile(entryPath, code);
        }

        const jsResult = await runCommandWithInput('node', [entryPath], input);
        finalResult = {
          status: jsResult.code !== 0 ? 'error' : 'success',
          output: jsResult.stdout,
          compileError: null,
          runtimeError: jsResult.stderr || null,
        };
        break;
      }

      // -----------------------------------------------------------------------
      // Python — interpreted, no compilation step
      // -----------------------------------------------------------------------
      case 'python': {
        const pyFiles = files.filter((f) => hasExt(f?.name, '.py'));
        let entryPath;

        if (pyFiles.length > 0) {
          await writeExecutionFiles(tempDir, pyFiles);
          const ef = findEntryFile(pyFiles, entryFileName, 'main.py');
          entryPath = path.join(tempDir, sanitizeRelativeFilePath(ef.name));
        } else {
          entryPath = path.join(tempDir, 'main.py');
          await fs.writeFile(entryPath, code);
        }

        const pyCmd = process.platform === 'win32' ? 'python' : 'python3';
        const pyResult = await runCommandWithInput(pyCmd, [entryPath], input);
        finalResult = {
          status: pyResult.code !== 0 ? 'error' : 'success',
          output: pyResult.stdout,
          compileError: null,
          runtimeError: pyResult.stderr || null,
        };
        break;
      }

      // -----------------------------------------------------------------------
      // Java — compiled; supports multi-file projects
      // -----------------------------------------------------------------------
      case 'java': {
        const javaProjectFiles = files.filter((f) => hasExt(f?.name, '.java'));
        let entryJavaFileName = null;
        let runClassName = null;

        if (javaProjectFiles.length > 0) {
          // Java is compiled from one job directory so javac *.java can resolve sibling classes.
          await writeJavaExecutionFiles(tempDir, javaProjectFiles);

          const entryFile = findEntryFile(javaProjectFiles, entryFileName, null);
          if (!entryFile || !hasExt(entryFile.name, '.java')) {
            throw new Error('Select a Java file to run (for example Main.java).');
          }

          entryJavaFileName = path.basename(sanitizeRelativeFilePath(entryFile.name));
          runClassName = path.basename(entryJavaFileName, '.java');
        } else {
          // Single-snippet fallback: derive a valid class name and write one file
          const detectedClass = getJavaClassNameFromCode(code);
          const className = detectedClass || jobTag;
          // If detected name differs from jobTag, keep the code as-is (preserves public class name)
          const srcCode = detectedClass
            ? code
            : code.replace(/public\s+class\s+\w+/, `public class ${className}`);
          entryJavaFileName = `${className}.java`;
          runClassName = className;
          await fs.writeFile(path.join(tempDir, entryJavaFileName), srcCode);
        }

        // Compile the active Java file; javac can compile sibling dependencies in the same directory.
        try {
          await execWithLimits(`javac "${entryJavaFileName}"`, { cwd: tempDir });
        } catch (compileErr) {
          finalResult = {
            status: 'compile-error',
            output: '',
            compileError: compileErr.stderr || compileErr.message,
            runtimeError: null,
          };
          break;
        }

        const javaResult = await runCommandWithInput('java', [runClassName], input, 10000, { cwd: tempDir });
        finalResult = {
          status: javaResult.code !== 0 ? 'error' : 'success',
          output: javaResult.stdout,
          compileError: null,
          runtimeError: javaResult.stderr || null,
        };
        break;
      }

      // -----------------------------------------------------------------------
      // C — compiled; supports multi-file projects (.c + .h)
      // -----------------------------------------------------------------------
      case 'c': {
        const cSrcFiles = files.filter((f) => hasExt(f?.name, '.c'));
        const cAllFiles = files.filter((f) => hasExt(f?.name, '.c') || hasExt(f?.name, '.h'));
        const mainExe = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');

        let compileCmd;
        if (cSrcFiles.length > 0) {
          // Write all C source and header files
          await writeExecutionFiles(tempDir, cAllFiles);
          // Compile all .c source files together, include tempDir for headers
          const srcPaths = cSrcFiles
            .map((f) => `"${path.join(tempDir, sanitizeRelativeFilePath(f.name))}"`)
            .join(' ');
          compileCmd = `gcc ${srcPaths} -I "${tempDir}" -o "${mainExe}"`;
        } else {
          await fs.writeFile(path.join(tempDir, 'main.c'), code);
          compileCmd = `gcc main.c -o main`;
        }

        try {
          await execWithLimits(compileCmd, { cwd: tempDir });
        } catch (compileErr) {
          finalResult = {
            status: 'compile-error',
            output: '',
            compileError: compileErr.stderr || compileErr.message,
            runtimeError: null,
          };
          break;
        }

        const cResult = await runCommandWithInput(mainExe, [], input);
        finalResult = {
          status: cResult.code !== 0 ? 'error' : 'success',
          output: cResult.stdout,
          compileError: null,
          runtimeError: cResult.stderr || null,
        };
        break;
      }

      // -----------------------------------------------------------------------
      // C++ — compiled; supports multi-file projects (.cpp/.cc/.cxx + .h/.hpp)
      // -----------------------------------------------------------------------
      case 'cpp': {
        const cppExts = ['.cpp', '.cc', '.cxx'];
        const cppSrcFiles = files.filter((f) => cppExts.some((ext) => hasExt(f?.name, ext)));
        const cppAllFiles = files.filter((f) =>
          [...cppExts, '.h', '.hpp'].some((ext) => hasExt(f?.name, ext))
        );
        const mainExe = path.join(tempDir, process.platform === 'win32' ? 'main.exe' : 'main');

        let compileCmd;
        if (cppSrcFiles.length > 0) {
          // Write all C++ source and header files
          await writeExecutionFiles(tempDir, cppAllFiles);
          // Compile all source files together, include tempDir for headers
          const srcPaths = cppSrcFiles
            .map((f) => `"${path.join(tempDir, sanitizeRelativeFilePath(f.name))}"`)
            .join(' ');
          compileCmd = `g++ ${srcPaths} -I "${tempDir}" -o "${mainExe}"`;
        } else {
          await fs.writeFile(path.join(tempDir, 'main.cpp'), code);
          compileCmd = `g++ main.cpp -o main`;
        }

        try {
          await execWithLimits(compileCmd, { cwd: tempDir });
        } catch (compileErr) {
          finalResult = {
            status: 'compile-error',
            output: '',
            compileError: compileErr.stderr || compileErr.message,
            runtimeError: null,
          };
          break;
        }

        const cppResult = await runCommandWithInput(mainExe, [], input);
        finalResult = {
          status: cppResult.code !== 0 ? 'error' : 'success',
          output: cppResult.stdout,
          compileError: null,
          runtimeError: cppResult.stderr || null,
        };
        break;
      }

      // -----------------------------------------------------------------------
      // C# — compiled with Mono
      // -----------------------------------------------------------------------
      case 'csharp': {
        const csFiles = files.filter((f) => hasExt(f?.name, '.cs'));
        const exeFile = path.join(tempDir, 'main.exe');

        if (csFiles.length > 0) {
          await writeExecutionFiles(tempDir, csFiles);
        } else {
          const csFile = path.join(tempDir, `${jobTag}.cs`);
          await fs.writeFile(csFile, code);
        }

        const sources = csFiles.length > 0
          ? csFiles
              .map((file) => `"${path.join(tempDir, sanitizeRelativeFilePath(file.name))}"`)
              .join(' ')
          : `"${path.join(tempDir, `${jobTag}.cs`)}"`;

        try {
          await execWithLimits(`csc /out:"${exeFile}" ${sources}`, { cwd: tempDir });
        } catch (compileErr) {
          finalResult = {
            status: 'compile-error',
            output: '',
            compileError: compileErr.stderr || compileErr.message,
            runtimeError: null,
          };
          break;
        }

        const csCmd = process.platform === 'win32' ? exeFile : 'mono';
        const csArgs = process.platform === 'win32' ? [] : [exeFile];
        const csResult = await runCommandWithInput(csCmd, csArgs, input);
        finalResult = {
          status: csResult.code !== 0 ? 'error' : 'success',
          output: csResult.stdout,
          compileError: null,
          runtimeError: csResult.stderr || null,
        };
        break;
      }

      default:
        throw new Error(`Unsupported language: ${executionLanguage}`);
    }

    // Clean up the temporary job directory
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      status: finalResult.status,
      output: finalResult.output || '',
      compileError: finalResult.compileError || null,
      runtimeError: finalResult.runtimeError || null,
      logs: buildExecutionLogs(finalResult),
      executionTime: Date.now() - startedAt,
      memoryUsed: 0,
    };

  } catch (error) {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }
    const isTimeout = error.message && error.message.includes('timeout');
    return {
      status: isTimeout ? 'timeout' : 'error',
      output: '',
      compileError: null,
      runtimeError: error.message || 'Execution failed',
      logs: buildExecutionLogs({ error: error.message || 'Execution failed' }),
      executionTime: Date.now() - startedAt,
      memoryUsed: 0,
    };
  }
}, {
  connection: redisClient,
  concurrency: 5
});

worker.on('completed', (job, result) => {
  console.log(`Job ${job.id} completed:`, result.status);
});

worker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Start worker (ioredis connects lazily via BullMQ)
console.log('🚀 Code Execution Worker starting...');
console.log('⏳ Connecting to Redis...');
console.log('🔁 Worker will keep retrying Redis connection until available');

// Optional health endpoint so the worker can run as a Render Web Service
// when Background Worker is unavailable on the current plan.
// Always start the HTTP server — use PORT env var (set automatically by Render)
// or fall back to 3001 so the process keeps a bound port on any platform.
const HEALTH_PORT = Number(process.env.PORT || 3001);

let healthServer = null;
healthServer = http.createServer((req, res) => {
  // /wake — respond immediately so Render cold-starts the container ASAP.
  // The actual job queue works through Redis; the worker is ready to pick
  // up jobs as soon as it has connected to Redis.
  if (req.url === '/wake') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'worker' }));
    return;
  }

  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'worker', redisConnected, redisState }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('collab-code-worker');
});

healthServer.listen(HEALTH_PORT, () => {
  console.log(`🌐 Worker health server listening on port ${HEALTH_PORT}`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down worker...');
  if (healthServer) {
    healthServer.close();
  }
  await worker.close();
  if (redisConnected) {
    await redisClient.quit();
  }
  process.exit(0);
});
