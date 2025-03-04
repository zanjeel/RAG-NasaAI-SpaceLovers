import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const path = request.nextUrl.pathname;

    console.log('=== MIDDLEWARE START ===')
    console.log('Request URL:', request.url)
    console.log('Request method:', request.method)
    console.log('Request path:', path)

    // Skip middleware for API routes completely
    if (path.startsWith('/api/')) {
        console.log('Skipping middleware for API route:', path);
        return NextResponse.next();
    }

    // Handle CORS preflight requests for non-API routes
    if (request.method === 'OPTIONS') {
        console.log('Handling OPTIONS request in middleware');
        return new NextResponse(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
            },
        });
    }

    // Get the response for non-API routes
    const response = NextResponse.next();

    // Add CORS headers to all non-API responses
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    console.log('=== MIDDLEWARE END ===')
    return response;
}

// Configure which paths the middleware should run on
export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         * - public folder
         */
        '/((?!_next/static|_next/image|favicon.ico|public).*)',
    ],
};
