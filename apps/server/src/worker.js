/**
 * Code Execution Worker
 * Processes code execution jobs from the BullMQ queue
 */

require("dotenv").config();

const { Worker } = require("bullmq");
const IORedis = require("ioredis");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

// BullMQ requires maxRetriesPerRequest to be null to avoid deprecation warnings
const redisConnection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

console.log("Starting code execution worker...");

const worker = new Worker(
  "code-execution",
  async (job) => {
    const { code, language, input = "" } = job.data;
    const startTime = Date.now();

    try {
      console.log(`[Worker] Processing job ${job.id} - Language: ${language}`);
      console.log(`[Worker] Code to execute:`, code.substring(0, 100) + (code.length > 100 ? '...' : ''));
      if (input) {
        console.log(`[Worker] Input provided (${input.length} chars)`);
      }

      let result = "";
      let error = "";
      let tempFile = null;

      try {
        // Execute code based on language
        switch (language.toLowerCase()) {
          case "python":
            try {
              // Create a temporary Python file
              tempFile = path.join(os.tmpdir(), `code_${job.id}.py`);
              fs.writeFileSync(tempFile, code, 'utf-8');
              
              console.log(`[Worker] Executing Python: ${tempFile}`);
              result = execSync(`python "${tempFile}"`, {
                encoding: "utf-8",
                timeout: 5000,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
                input: input // Pass input to stdin
              });
              console.log(`[Worker] Python output:`, result);
            } catch (err) {
              error = err.stdout?.toString() || err.stderr?.toString() || err.message || err.toString();
              console.error(`[Worker] Python error:`, error);
            }
            break;

          case "javascript":
            try {
              // Create a temporary JavaScript file
              tempFile = path.join(os.tmpdir(), `code_${job.id}.js`);
              fs.writeFileSync(tempFile, code, 'utf-8');
              
              console.log(`[Worker] Executing JavaScript: ${tempFile}`);
              result = execSync(`node "${tempFile}"`, {
                encoding: "utf-8",
                timeout: 5000,
                maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr
                input: input // Pass input to stdin
              });
              console.log(`[Worker] JavaScript output:`, result);
            } catch (err) {
              error = err.stdout?.toString() || err.stderr?.toString() || err.message || err.toString();
              console.error(`[Worker] JavaScript error:`, error);
            }
            break;

          case "java":
            try {
              // Extract public class name from code, or use "Code" as default
              let className = 'Code';
              const classMatch = code.match(/public\s+class\s+(\w+)/);
              if (classMatch) {
                className = classMatch[1];
              }
              
              // Java requires: public class NAME must be in file NAME.java
              // So we MUST use the class name, not a job-specific name
              tempFile = path.join(os.tmpdir(), `${className}.java`);
              fs.writeFileSync(tempFile, code, 'utf-8');
              
              console.log(`[Worker] Compiling Java: ${tempFile}`);
              
              // Compile Java code
              try {
                execSync(`javac "${tempFile}"`, {
                  encoding: "utf-8",
                  timeout: 10000,
                  maxBuffer: 1024 * 1024 * 10,
                  stdio: ['pipe', 'pipe', 'pipe']
                });
              } catch (compileErr) {
                error = compileErr.stdout?.toString() || compileErr.stderr?.toString() || compileErr.message || compileErr.toString();
                console.error(`[Worker] Java compilation error:`, error);
                throw compileErr;
              }

              // Execute compiled Java code
              const classDir = os.tmpdir();
              console.log(`[Worker] Executing Java: ${className}`);
              result = execSync(`java -cp "${classDir}" ${className}`, {
                encoding: "utf-8",
                timeout: 5000,
                maxBuffer: 1024 * 1024 * 10,
                stdio: ['pipe', 'pipe', 'pipe'],
                input: input
              });
              console.log(`[Worker] Java output:`, result);
            } catch (err) {
              if (!error) {
                error = err.stdout?.toString() || err.stderr?.toString() || err.message || err.toString();
              }
              console.error(`[Worker] Java error:`, error);
            }
            break;

          case "cpp":
          case "c":
            error = "C/C++ execution not yet implemented in this environment";
            break;

          default:
            error = `Unsupported language: ${language}`;
        }
      } finally {
        // Clean up temporary files (both .java and .class)
        const tempDir = os.tmpdir();
        const classMatch = code.match(/public\s+class\s+(\w+)/);
        const className = classMatch ? classMatch[1] : 'Code';
        
        // Clean up source file
        if (tempFile && fs.existsSync(tempFile)) {
          try {
            fs.unlinkSync(tempFile);
            console.log(`[Worker] Cleaned up temp file: ${tempFile}`);
          } catch (cleanupErr) {
            console.warn(`[Worker] Failed to clean up temp file: ${cleanupErr.message}`);
          }
        }
        
        // Clean up compiled Java class file
        if (language.toLowerCase() === 'java') {
          // Class file is named after the public class, not the filename
          const classFile = path.join(tempDir, `${className}.class`);
          if (fs.existsSync(classFile)) {
            try {
              fs.unlinkSync(classFile);
              console.log(`[Worker] Cleaned up class file: ${classFile}`);
            } catch (cleanupErr) {
              console.warn(`[Worker] Failed to clean up class file: ${cleanupErr.message}`);
            }
          }
        }
      }

      const executionTime = Date.now() - startTime;

      console.log(`[Worker] Job ${job.id} completed in ${executionTime}ms`);

      return {
        status: error ? "error" : "success",
        output: result,
        error,
        executionTime
      };
    } catch (err) {
      const executionTime = Date.now() - startTime;
      console.error(`[Worker] Job ${job.id} failed:`, err.message);

      return {
        status: "error",
        output: "",
        error: err.message,
        executionTime
      };
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
    settings: {
      stalledInterval: 5000,
      lockDuration: 30000,
      lockRenewTime: 15000
    }
  }
);

worker.on("completed", (job, result) => {
  console.log(`[Worker] Job ${job.id} completed successfully`);
});

worker.on("failed", (job, err) => {
  console.error(`[Worker] Job ${job.id} failed:`, err.message);
});

worker.on("error", (err) => {
  console.error("[Worker] Error:", err);
});

console.log("[Worker] Code execution worker is ready and listening for jobs");

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("[Worker] Shutting down...");
  await worker.close();
  await redisConnection.quit();
  process.exit(0);
});
