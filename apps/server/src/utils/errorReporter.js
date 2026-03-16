const logger = require('./logger');

const ERROR_REPORT_WEBHOOK_URL = process.env.ERROR_REPORT_WEBHOOK_URL;

const reportError = async (error, context = {}) => {
  const payload = {
    message: error?.message || 'Unknown error',
    stack: error?.stack || null,
    context,
    timestamp: new Date().toISOString(),
  };

  logger.error('Application error reported', payload);

  if (!ERROR_REPORT_WEBHOOK_URL) {
    return;
  }

  try {
    await fetch(ERROR_REPORT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (webhookErr) {
    logger.error('Failed to deliver error report webhook', {
      message: webhookErr?.message,
    });
  }
};

module.exports = { reportError };
