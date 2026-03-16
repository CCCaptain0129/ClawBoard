import type { NextFunction, Request, Response } from 'express';

function getConfiguredAccessToken(): string {
  return (process.env.BOARD_ACCESS_TOKEN || '').trim();
}

function extractTokenFromRequest(request: Request): string {
  const authHeader = request.header('authorization');
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }

  const headerToken = request.header('x-access-token');
  if (headerToken) {
    return headerToken.trim();
  }

  const queryToken = typeof request.query.token === 'string' ? request.query.token : '';
  return queryToken.trim();
}

export function isAccessTokenValid(token: string): boolean {
  const configuredToken = getConfiguredAccessToken();
  if (!configuredToken) {
    return true;
  }

  return token === configuredToken;
}

export function accessTokenMiddleware(request: Request, response: Response, next: NextFunction): void {
  const configuredToken = getConfiguredAccessToken();
  if (!configuredToken) {
    next();
    return;
  }

  const token = extractTokenFromRequest(request);
  if (!isAccessTokenValid(token)) {
    response.status(401).json({ error: 'Unauthorized', details: 'Invalid access token' });
    return;
  }

  next();
}
