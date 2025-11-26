const chalk = require('chalk');

const formatDuration = (start) => {
  const diff = process.hrtime(start);
  const duration = diff[0] * 1e3 + diff[1] / 1e6;
  return `${duration.toFixed(1)}ms`;
};

const getColorByStatus = (status) => {
  if (status >= 500) return chalk.red;
  if (status >= 400) return chalk.yellow;
  if (status >= 300) return chalk.cyan;
  return chalk.green;
};

const requestLogger = (req, res, next) => {
  const start = process.hrtime();
  const { method, originalUrl } = req;
  const requestId = Math.random().toString(36).slice(2, 8);

  console.log(chalk.gray(`[${requestId}] ➜ ${method} ${originalUrl}`));

  res.on('finish', () => {
    const statusColor = getColorByStatus(res.statusCode);
    const duration = formatDuration(start);
    console.log(
      statusColor(`[${requestId}] ⇦ ${method} ${originalUrl} ${res.statusCode} (${duration})`),
    );
  });

  next();
};

module.exports = requestLogger;

