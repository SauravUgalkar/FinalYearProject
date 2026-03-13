require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Initialize Redis (BullMQ requires ioredis)
const redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  retryStrategy: (times) => {
    if (times > 3) {
      console.error('❌ Could not connect to Redis. Make sure Redis is running.');
      console.error('💡 Start Redis with: docker compose up -d redis');
      console.error('💡 Or install Redis locally and run: redis-server');
      return null; // Stop retrying
    }
    return Math.min(times * 100, 3000);
  },
});

let redisConnected = false;
redisClient.on('error', (err) => {
  if (!redisConnected) {
    console.error('Redis connection failed');
  }
});
redisClient.on('connect', () => {
  redisConnected = true;
  console.log('Redis connected');
});

const EXECUTION_DIR = '/tmp/code-execution';

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

const runCommandWithInput = (command, args, input, timeout = 10000, options = {}) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeout,
      cwd: options.cwd,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
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

const worker = new Worker('code-execution', async (job) => {
  console.log(`Processing job ${job.id}...`);

  const { code, language, input, files = [], entryFileName } = job.data;
  const executionLanguage = normalizeExecutionLanguage(language, files, entryFileName);
  const jobId = job.id;
  const jobTag = `job_${jobId}`;

  const tempDir = path.join(EXECUTION_DIR, jobTag);

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
          await execAsync(`cd "${tempDir}" && javac "${entryJavaFileName}"`);
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
          compileCmd = `cd "${tempDir}" && gcc main.c -o main`;
        }

        try {
          await execAsync(compileCmd);
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
          compileCmd = `cd "${tempDir}" && g++ main.cpp -o main`;
        }

        try {
          await execAsync(compileCmd);
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
        const csFile = path.join(tempDir, `${jobTag}.cs`);
        const exeFile = path.join(tempDir, `${jobTag}.exe`);
        await fs.writeFile(csFile, code);

        try {
          await execAsync(`cd "${tempDir}" && csc "${csFile}"`);
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
      executionTime: 0,
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
      executionTime: 0,
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

// Check Redis connection after a delay
setTimeout(() => {
  if (!redisConnected) {
    console.error('\n⚠️  Worker cannot start without Redis connection.');
    console.error('   Exiting...\n');
    process.exit(1);
  } else {
    console.log('✅ Worker is ready and listening for code execution jobs');
  }
}, 5000);

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down worker...');
  await worker.close();
  if (redisConnected) {
    await redisClient.quit();
  }
  process.exit(0);
});
