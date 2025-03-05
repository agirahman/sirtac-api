import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../error/ForbidenError";

// Add the interface definition here
interface AuthenticatedRequest extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export const authorizeRoles = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Cast the regular request to your authenticated request type
    const authReq = req as AuthenticatedRequest;

    // Now TypeScript knows that user exists and has a role property
    if (!roles.includes(authReq.user.role)) {
      throw new ForbiddenError("Forbidden: Insufficient permissions"); // res
    }
    next();
  };
};
