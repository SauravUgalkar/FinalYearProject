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
    console.error('\n❌ Redis connection failed!');
    console.error('   Make sure Redis is running on localhost:6379');
    console.error('\n📋 To start Redis:');
    console.error('   Option 1: docker compose up -d redis');
    console.error('   Option 2: Install and run redis-server\n');
  }
});
redisClient.on('connect', () => {
  redisConnected = true;
  console.log('✅ Redis connected');
});

// Code execution directory
const EXECUTION_DIR = '/tmp/code-execution';

// Helper function to run command with input
const runCommandWithInput = (command, args, input, timeout = 10000) => {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: timeout
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

// Initialize execution worker
const worker = new Worker('code-execution', async (job) => {
  console.log(`Processing job ${job.id}...`);

  const { code, language, input } = job.data;
  const jobId = job.id;
  const fileName = `job_${jobId}`;

  try {
    // Create temporary directory for execution
    const tempDir = path.join(EXECUTION_DIR, fileName);
    await fs.mkdir(tempDir, { recursive: true });

    let executeCommand = '';
    let commandArgs = [];
    let result = null;

    // Prepare execution based on language
    switch (language) {
      case 'javascript':
        {
          const jsFile = path.join(tempDir, `${fileName}.js`);
          await fs.writeFile(jsFile, code);
          executeCommand = 'node';
          commandArgs = [jsFile];
          result = await runCommandWithInput(executeCommand, commandArgs, input);
        }
        break;

      case 'python':
        {
          const pyFile = path.join(tempDir, `${fileName}.py`);
          await fs.writeFile(pyFile, code);

          // Prefer python3, fallback to python on Windows if python3 alias missing
          const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
          executeCommand = pythonCmd;
          commandArgs = [pyFile];
          result = await runCommandWithInput(executeCommand, commandArgs, input);
        }
        break;

      case 'java':
        {
          const javaFile = path.join(tempDir, `${fileName}.java`);
          const className = fileName;
          
          // Java requires specific class name
          const javaCode = code.replace(
            /public\s+class\s+\w+/,
            `public class ${className}`
          );
          
          await fs.writeFile(javaFile, javaCode);
          
          // Compile Java
          await execAsync(`cd "${tempDir}" && javac "${javaFile}"`);
          
          executeCommand = 'java';
          commandArgs = ['-cp', tempDir, className];
          result = await runCommandWithInput(executeCommand, commandArgs, input);
        }
        break;

      case 'cpp':
        {
          const cppFile = path.join(tempDir, `${fileName}.cpp`);
          const exeFile = path.join(tempDir, process.platform === 'win32' ? `${fileName}.exe` : fileName);
          
          await fs.writeFile(cppFile, code);
          
          // Compile C++
          const compileCmd = process.platform === 'win32' 
            ? `cd "${tempDir}" && g++ -o ${fileName}.exe "${cppFile}"`
            : `cd "${tempDir}" && g++ -o ${fileName} "${cppFile}"`;
          
          await execAsync(compileCmd);
          
          executeCommand = exeFile;
          commandArgs = [];
          result = await runCommandWithInput(executeCommand, commandArgs, input);
        }
        break;

      case 'c':
        {
          const cFile = path.join(tempDir, `${fileName}.c`);
          const exeFile = path.join(tempDir, process.platform === 'win32' ? `${fileName}.exe` : fileName);
          
          await fs.writeFile(cFile, code);
          
          // Compile C
          const compileCmd = process.platform === 'win32' 
            ? `cd "${tempDir}" && gcc -o ${fileName}.exe "${cFile}"`
            : `cd "${tempDir}" && gcc -o ${fileName} "${cFile}"`;
          
          await execAsync(compileCmd);
          
          executeCommand = exeFile;
          commandArgs = [];
          result = await runCommandWithInput(executeCommand, commandArgs, input);
        }
        break;

      case 'csharp':
        {
          const csFile = path.join(tempDir, `${fileName}.cs`);
          const exeFile = path.join(tempDir, `${fileName}.exe`);
          
          await fs.writeFile(csFile, code);
          
          // Compile C#
          await execAsync(`cd "${tempDir}" && csc "${csFile}"`);
          
          executeCommand = process.platform === 'win32' ? exeFile : 'mono';
          commandArgs = process.platform === 'win32' ? [] : [exeFile];
          result = await runCommandWithInput(executeCommand, commandArgs, input);
        }
        break;

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });

    const { stdout, stderr } = result;

    // Check if stderr contains actual errors (not just warnings)
    const hasError = stderr && (
      stderr.toLowerCase().includes('error') ||
      stderr.toLowerCase().includes('exception') ||
      stderr.toLowerCase().includes('traceback') ||
      stderr.toLowerCase().includes('fatal') ||
      stderr.toLowerCase().includes('cannot find') ||
      stderr.toLowerCase().includes('undefined reference') ||
      stderr.toLowerCase().includes('segmentation fault')
    );

    return {
      status: hasError ? 'error' : 'success',
      output: stdout,
      error: stderr || null,
      executionTime: 0,
      memoryUsed: 0
    };
  } catch (error) {
    // Clean up
    try {
      await fs.rm(path.join(EXECUTION_DIR, fileName), { recursive: true, force: true });
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError);
    }

    const isTimeout = error.message.includes('timeout');
    return {
      status: isTimeout ? 'timeout' : 'error',
      output: '',
      error: error.message || 'Execution failed',
      executionTime: 0,
      memoryUsed: 0
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
