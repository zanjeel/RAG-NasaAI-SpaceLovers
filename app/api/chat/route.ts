import { GoogleGenerativeAI } from "@google/generative-ai"
import { StreamingTextResponse, createStreamDataTransformer } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"
import { NextResponse } from 'next/server'

// Add CORS headers
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: Request) {
    console.log('=== OPTIONS HANDLER CALLED ===')
    console.log('Request URL:', request.url)
    console.log('Request method:', request.method)
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))
    return new Response(null, {
        status: 204,
        headers: corsHeaders
    })
}

const {
    ASTRA_DB_NAMESPACE, 
    ASTRA_DB_COLLECTION, 
    ASTRA_DB_API_ENDPOINT, 
    ASTRA_DB_APPLICATION_TOKEN, 
    GOOGLE_API_KEY
} = process.env

// Log environment variables (without sensitive data)
console.log('Environment check:', {
    hasApiEndpoint: !!ASTRA_DB_API_ENDPOINT,
    hasNamespace: !!ASTRA_DB_NAMESPACE,
    hasCollection: !!ASTRA_DB_COLLECTION,
    hasToken: !!ASTRA_DB_APPLICATION_TOKEN,
    hasGoogleKey: !!GOOGLE_API_KEY,
    apiEndpoint: ASTRA_DB_API_ENDPOINT?.substring(0, 20) + '...' // Log first 20 chars only
})

// Validate environment variables
function validateEnv() {
    console.log('Validating environment variables...')
    if (!GOOGLE_API_KEY) {
        console.error('Missing GOOGLE_API_KEY')
        return NextResponse.json({ error: 'GOOGLE_API_KEY is not set in environment variables' }, { status: 500, headers: corsHeaders })
    }

    if (!ASTRA_DB_API_ENDPOINT) {
        console.error('Missing ASTRA_DB_API_ENDPOINT')
        return NextResponse.json({ error: 'ASTRA_DB_API_ENDPOINT is not set in environment variables' }, { status: 500, headers: corsHeaders })
    }

    if (!ASTRA_DB_NAMESPACE) {
        console.error('Missing ASTRA_DB_NAMESPACE')
        return NextResponse.json({ error: 'ASTRA_DB_NAMESPACE is not set in environment variables' }, { status: 500, headers: corsHeaders })
    }

    if (!ASTRA_DB_COLLECTION) {
        console.error('Missing ASTRA_DB_COLLECTION')
        return NextResponse.json({ error: 'ASTRA_DB_COLLECTION is not set in environment variables' }, { status: 500, headers: corsHeaders })
    }

    if (!ASTRA_DB_APPLICATION_TOKEN) {
        console.error('Missing ASTRA_DB_APPLICATION_TOKEN')
        return NextResponse.json({ error: 'ASTRA_DB_APPLICATION_TOKEN is not set in environment variables' }, { status: 500, headers: corsHeaders })
    }

    console.log('Environment validation passed')
    return null
}

// Initialize Gemini AI only if API key is available
let genAI: GoogleGenerativeAI | null = null;
let model: any = null;

if (GOOGLE_API_KEY) {
    genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
    model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

// Initialize Astra DB client with error handling
let client: DataAPIClient | null = null;
let db: any = null;

function initializeDB() {
    try {
        console.log('Initializing Astra DB client...')
        if (!ASTRA_DB_APPLICATION_TOKEN) {
            throw new Error('ASTRA_DB_APPLICATION_TOKEN is not set');
        }
        client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
        console.log('Creating DB connection...')
        if (!ASTRA_DB_API_ENDPOINT || !ASTRA_DB_NAMESPACE) {
            throw new Error('ASTRA_DB_API_ENDPOINT or ASTRA_DB_NAMESPACE is not set');
        }
        db = client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPACE})
        console.log('DB connection successful')
        return null
    } catch (error) {
        console.error('Failed to initialize Astra DB:', error)
        return NextResponse.json({ error: `Failed to initialize Astra DB: ${error.message}` }, { status: 500, headers: corsHeaders })
    }
}

// Initialize the database
const dbError = initializeDB()
if (dbError) {
    console.error('Failed to initialize database:', dbError)
}

// Export the POST handler
export async function POST(request: Request) {
    console.log('=== POST HANDLER CALLED ===')
    console.log('Request URL:', request.url)
    console.log('Request method:', request.method)
    console.log('Request headers:', Object.fromEntries(request.headers.entries()))
    
    try {
        // Log the request body
        const body = await request.json()
        console.log('Request body:', body)
        
        // Validate environment variables
        const envError = validateEnv()
        if (envError) {
            console.error('Environment validation failed:', envError)
            return envError
        }

        if (!genAI || !model) {
            return NextResponse.json({ error: 'Gemini AI not initialized' }, { status: 500, headers: corsHeaders })
        }

        const {messages} = body
        console.log('Received messages:', messages)
        
        const latestMessage = messages[messages?.length-1]?.content
        console.log('Latest message:', latestMessage)
        
        let docContext = ""

        // Get embedding from Gemini
        console.log('Getting embedding from Gemini...')
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" })
        const embedding = await embeddingModel.embedContent(latestMessage)
        const embeddingArray = Array.from(embedding.embedding as unknown as number[])
        console.log('Got embedding, length:', embeddingArray.length)

        try {
            console.log('Querying database with embedding...')
            if (!db || !ASTRA_DB_COLLECTION) {
                throw new Error('Database or collection not initialized');
            }
            const collection = await db.collection(ASTRA_DB_COLLECTION)
            const cursor = collection.find(null, {
                sort: {
                    $vector: embeddingArray,
                },
                limit: 10
            })

            const documents = await cursor.toArray()
            console.log('Found documents:', documents.length)
            const docsMap = documents?.map(doc => doc.text)
            docContext = JSON.stringify(docsMap)
        } catch(err) {
            console.error("Error querying db:", err)
            docContext = ""
        }

        // Format the conversation history for Gemini
        console.log('Formatting messages for Gemini...')
        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
        }))

        // Add the system prompt
        formattedMessages.unshift({
            role: 'user',
            parts: [{
                text: `You are a funny, space nerd who knows everything
                about NASA. You must know their recent space exploration missions and latest space news. 
                The context will provide you with data from the NASA Wikipedia Websites.
                If the context doesn't include the information you need, answer
                based on your existing knowledge.

                Format your responses as follows:
                1. Break information into clear, concise paragraphs but keep them fun and nerdy.
                2. Each paragraph should be 3-5 lines maximum.
                3. Use 2 line spacing between paragraphs.
                4. Do not use asterisks or markdown formatting or images.
                5. Use simple, clear language.
                6. Keep sentences short and direct but nerdy.

                -----------
                START CONTEXT
                ${docContext}
                END CONTEXT
                ------------
                QUESTION: ${latestMessage}
                ------------
                `
            }]
        })

        console.log('Sending to Gemini:', formattedMessages)
        const result = await model.generateContentStream({
            contents: formattedMessages
        })

        // Convert Gemini stream to ReadableStream
        console.log('Creating streaming response...')
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let buffer = ""; // Buffer to accumulate text properly
        
                    for await (const chunk of result.stream) {
                        const text = chunk.text();
                        console.log('Received chunk:', text);
                        
                        if (text) {
                            buffer += text; // Append new chunk to the buffer
        
                            // Check if the buffer has a complete sentence
                            if (buffer.includes('. ') || buffer.includes('! ') || buffer.includes('? ')) {
                                controller.enqueue(new TextEncoder().encode(buffer + '\n')); 
                                buffer = ""; // Reset buffer after sending
                            }
                        }
                    }
        
                    // Send any remaining text in the buffer
                    if (buffer.trim().length > 0) {
                        controller.enqueue(new TextEncoder().encode(buffer + '\n\n'));
                    }
        
                    controller.close();
                    console.log('Stream completed successfully')
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.error(error);
                }
            }
        });
        
        // Use the ai package's stream transformer
        const transformedStream = stream.pipeThrough(createStreamDataTransformer())
        
        console.log('Returning streaming response')
        return new StreamingTextResponse(transformedStream, { headers: corsHeaders })
    } catch(err: any) {
        console.error('=== API ERROR ===')
        console.error('Error type:', err.name)
        console.error('Error message:', err.message)
        console.error('Error stack:', err.stack)
        console.error('Error details:', {
            message: err.message,
            stack: err.stack,
            name: err.name
        })
        
        // Handle specific error types
        if (err.message?.includes('429')) {
            return NextResponse.json({ 
                error: 'Rate limit exceeded. Please try again later or check your API quota.',
                details: err.message 
            }, { status: 429, headers: corsHeaders })
        }
        
        if (err.message?.includes('API key')) {
            return NextResponse.json({ 
                error: 'Invalid API key. Please check your GOOGLE_API_KEY environment variable.',
                details: err.message 
            }, { status: 401, headers: corsHeaders })
        }

        return NextResponse.json({ 
            error: 'Internal server error',
            details: err.message 
        }, { status: 500, headers: corsHeaders })
    }
}