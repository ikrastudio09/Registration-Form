/**
 * API Response & Error Handler Utilities
 */

/**
 * Standard API success response
 */
export function successResponse(data, message = 'Success', status = 200) {
  return Response.json(
    {
      success: true,
      message,
      data,
    },
    { status }
  );
}

/**
 * Standard API error response
 */
export function errorResponse(message = 'Internal Server Error', status = 500, errors = null) {
  const body = {
    success: false,
    message,
  };

  if (errors) {
    body.errors = errors;
  }

  return Response.json(body, { status });
}

/**
 * Parse Mongoose validation errors into readable format
 */
export function parseMongooseErrors(error) {
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map((err) => ({
      field: err.path,
      message: err.message,
    }));
    return { message: 'Validation failed', errors, status: 400 };
  }

  // Duplicate key error (unique constraint)
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    const value = error.keyValue[field];
    return {
      message: `${field === 'transactionId' ? 'Transaction ID' : field} "${value}" already exists. Please use a unique value.`,
      status: 409,
    };
  }

  return { message: error.message || 'Database error', status: 500 };
}

/**
 * Validate required fields in request body
 */
export function validateRequiredFields(body, fields) {
  const missing = fields.filter((field) => !body[field]);
  if (missing.length > 0) {
    return `Missing required fields: ${missing.join(', ')}`;
  }
  return null;
}

/**
 * Validate Indian mobile number format
 */
export function validateMobile(mobile) {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
}
