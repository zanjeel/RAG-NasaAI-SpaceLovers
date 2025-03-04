import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    console.log('Middleware processing request:', {
        method: request.method,
        path,
        headers: Object.fromEntries([...request.headers.entries()].filter(([key]) => key !== 'authorization'))
    });

    // Skip middleware for API routes
    if (path.startsWith('/api/')) {
        console.log('Skipping middleware for API route:', path);
        return NextResponse.next();
    }

    // Handle OPTIONS preflight request
    if (request.method === 'OPTIONS') {
        console.log('Handling OPTIONS preflight request');
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            },
        });
    }

    // Get the response and add CORS headers
    const response = NextResponse.next();
    
    // Add CORS headers to the response
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    console.log('Request processed, continuing to handler');
    return response;
}

// Configure which paths the middleware should run on
export const config = {
    matcher: [
        // Match all paths except static files and API routes
        '/((?!_next/static|_next/image|favicon.ico|api/).*)',
    ],
};
