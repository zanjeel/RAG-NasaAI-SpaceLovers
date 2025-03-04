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
export async function OPTIONS() {
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
    if (!GOOGLE_API_KEY) {
        return NextResponse.json({ error: 'GOOGLE_API_KEY is not set in environment variables' }, { status: 500 })
    }

    if (!ASTRA_DB_API_ENDPOINT) {
        return NextResponse.json({ error: 'ASTRA_DB_API_ENDPOINT is not set in environment variables' }, { status: 500 })
    }

    if (!ASTRA_DB_NAMESPACE) {
        return NextResponse.json({ error: 'ASTRA_DB_NAMESPACE is not set in environment variables' }, { status: 500 })
    }

    if (!ASTRA_DB_COLLECTION) {
        return NextResponse.json({ error: 'ASTRA_DB_COLLECTION is not set in environment variables' }, { status: 500 })
    }

    if (!ASTRA_DB_APPLICATION_TOKEN) {
        return NextResponse.json({ error: 'ASTRA_DB_APPLICATION_TOKEN is not set in environment variables' }, { status: 500 })
    }

    return null
}

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

// Initialize Astra DB client with error handling
let client;
let db;

function initializeDB() {
    try {
        console.log('Initializing Astra DB client...')
        client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
        console.log('Creating DB connection...')
        db = client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPACE})
        console.log('DB connection successful')
        return null
    } catch (error) {
        console.error('Failed to initialize Astra DB:', error)
        return NextResponse.json({ error: `Failed to initialize Astra DB: ${error.message}` }, { status: 500 })
    }
}

// Initialize the database
const dbError = initializeDB()
if (dbError) {
    console.error('Failed to initialize database:', dbError)
}

export async function POST(req: Request){
    try {
        // Validate environment variables
        const envError = validateEnv()
        if (envError) return envError

        const {messages} = await req.json()
        console.log('Received messages:', messages)
        
        const latestMessage = messages[messages?.length-1]?.content
        console.log('Latest message:', latestMessage)
        
        let docContext = ""

        // Get embedding from Gemini
        const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" })
        const embedding = await embeddingModel.embedContent(latestMessage)
        const embeddingArray = Array.from(embedding.embedding as unknown as number[])

        try {
            const collection = await db.collection(ASTRA_DB_COLLECTION)
            const cursor = collection.find(null, {
                sort: {
                    $vector: embeddingArray,
                },
                limit: 10
            })

            const documents = await cursor.toArray()
            const docsMap = documents?.map(doc => doc.text)
            docContext = JSON.stringify(docsMap)
        } catch(err) {
            console.log("Error querying db...")
            docContext = ""
        }

        // Format the conversation history for Gemini
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
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.error(error);
                }
            }
        });
        
        // Use the ai package's stream transformer
        const transformedStream = stream.pipeThrough(createStreamDataTransformer())
        
        return new StreamingTextResponse(transformedStream)
    } catch(err: any) {
        console.error('API error:', err)
        
        // Handle specific error types
        if (err.message?.includes('429')) {
            return NextResponse.json({ 
                error: 'Rate limit exceeded. Please try again later or check your API quota.',
                details: err.message 
            }, { status: 429 })
        }
        
        if (err.message?.includes('API key')) {
            return NextResponse.json({ 
                error: 'Invalid API key. Please check your GOOGLE_API_KEY environment variable.',
                details: err.message 
            }, { status: 401 })
        }

        return NextResponse.json({ 
            error: 'Internal server error',
            details: err.message 
        }, { status: 500 })
    }
}