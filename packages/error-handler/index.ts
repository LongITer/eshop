export class AppError extends Error {
    public readonly statusCode: number;
    public readonly isOperational: boolean;
    public readonly details?: any;

    constructor(message: string, statusCode: number, isOperational = true, details?: any) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        this.details = details;
        Error.captureStackTrace(this);
    }
}

// Not found error
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

// Validation error (use for zod/react-hook-form validation error)
export class ValidationError extends AppError {
    constructor(message = "Invalid request data", details?: any) {
        super(message, 400, true, details);
    }
}

// Authentication error
export class AuthError extends AppError {
    constructor(message = "Unauthorizes") {
        super(message, 401)
    }
}

// Forbidden Error
export class ForbiddenError extends AppError {
    constructor(message = "Forbidden access") {
        super(message, 403)
    }
}

// Database Error
export class DatabaseError extends AppError {
    constructor(message = "Database error", details?: any) {
        super(message, 500, true, details);
    }
}

// Rate limit error(If user exceeds API limits)
export class RateLimitError extends AppError {
    constructor(message = "Too many requests, please try again later !") {
        super(message, 429)
    }
}