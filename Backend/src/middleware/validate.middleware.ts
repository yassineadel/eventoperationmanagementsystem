import { Request, Response, NextFunction } from 'express'
import { ZodType } from 'zod'

/**
 * Returns an Express middleware that validates req.body against a Zod schema.
 * On success, req.body is replaced with the parsed (cleaned) data.
 * On failure, responds 400 with every problem at once.
 */
export const validate =
  (schema: ZodType) =>
  (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      res.status(400).json({
        message: 'Validation failed',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
      return
    }

    req.body = result.data
    next()
  }