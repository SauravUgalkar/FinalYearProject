require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

// Initialize Redis (BullMQ requires ioredis)
const redisClient = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));
redisClient.on('connect', () => console.log('Redis connected'));

// Code execution directory
const EXECUTION_DIR = '/tmp/code-execution';

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

    let compiledFile = null;
    let executeCommand = '';
    const inputFile = input ? path.join(tempDir, 'input.txt') : null;

    // Prepare input file if needed
    if (inputFile) {
      await fs.writeFile(inputFile, input);
    }

    // Prepare execution based on language
    switch (language) {
      case 'javascript':
        {
          const jsFile = path.join(tempDir, `${fileName}.js`);
          await fs.writeFile(jsFile, code);
          executeCommand = `node "${jsFile}"`;
          if (inputFile) executeCommand += ` < "${inputFile}"`;
        }
        break;

      case 'python':
        {
          const pyFile = path.join(tempDir, `${fileName}.py`);
          await fs.writeFile(pyFile, code);

          // Prefer python3, fallback to python on Windows if python3 alias missing
          const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
          executeCommand = `${pythonCmd} "${pyFile}"`;
          if (inputFile) executeCommand += ` < "${inputFile}"`;
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
          
          executeCommand = `cd "${tempDir}" && java ${className}`;
          if (inputFile) executeCommand += ` < "${inputFile}"`;
        }
        break;

      case 'cpp':
        {
          const cppFile = path.join(tempDir, `${fileName}.cpp`);
          const exeFile = path.join(tempDir, fileName);
          
          await fs.writeFile(cppFile, code);
          
          // Compile C++
          await execAsync(`cd "${tempDir}" && g++ -o ${fileName} "${cppFile}"`);
          
          executeCommand = `"${exeFile}"`;
          if (inputFile) executeCommand += ` < "${inputFile}"`;
        }
        break;

      case 'csharp':
        {
          const csFile = path.join(tempDir, `${fileName}.cs`);
          const exeFile = path.join(tempDir, `${fileName}.exe`);
          
          await fs.writeFile(csFile, code);
          
          // Compile C#
          await execAsync(`cd "${tempDir}" && csc "${csFile}"`);
          
          executeCommand = `"${exeFile}"`;
          if (inputFile) executeCommand += ` < "${inputFile}"`;
        }
        break;

      default:
        throw new Error(`Unsupported language: ${language}`);
    }

    // Execute with timeout (10 seconds)
    const startTime = Date.now();
    const { stdout, stderr } = await execAsync(executeCommand, {
      timeout: 10000,
      maxBuffer: 1024 * 1024 // 1MB
    });
    const executionTime = Date.now() - startTime;

    // Clean up
    await fs.rm(tempDir, { recursive: true, force: true });

    return {
      status: 'success',
      output: stdout,
      error: stderr || null,
      executionTime,
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
console.log('Code Execution Worker started');
console.log('Listening for code execution jobs...');

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down worker...');
  await worker.close();
  await redisClient.quit();
  process.exit(0);
});
