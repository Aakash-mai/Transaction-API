const winston = require('winston');
const WinstonDailyRotateFile = require('winston-daily-rotate-file');

const istTimestamp = () =>
    new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: false })
        .replace(",", "");

// Define the log format
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: istTimestamp }),
    winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} IST [${level}]: ${message}`;
    })
);

// Create the daily rotate file transport
const dailyRotateFileTransport = new WinstonDailyRotateFile({
    filename: 'logs/log-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
});

// Create the winston logger
const logger = winston.createLogger({
    level: 'info',
    format: logFormat,
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        }),
        dailyRotateFileTransport
    ]
});

module.exports = logger;