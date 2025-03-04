import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    console.log('Middleware processing request:', {
        method: request.method,
        path: request.nextUrl.pathname,
        headers: Object.fromEntries(request.headers.entries())
    });

    // Get the pathname of the request (e.g. /, /api/chat)
    const path = request.nextUrl.pathname;

    // Add CORS headers for all responses
    const response = NextResponse.next();

    // Add CORS headers
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    // Handle OPTIONS preflight request
    if (request.method === 'OPTIONS') {
        console.log('Handling OPTIONS preflight request');
        return new Response(null, { 
            status: 204, 
            headers: response.headers 
        });
    }

    console.log('Request processed, continuing to handler');
    return response;
}

// Configure which paths the middleware should run on
export const config = {
    matcher: [
        // Match all paths except static files and api routes
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
};