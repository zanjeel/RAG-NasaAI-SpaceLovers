import { GoogleGenerativeAI } from "@google/generative-ai"
import { createTextStreamResponse } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"
import { NextResponse } from 'next/server'
import { HfInference } from '@huggingface/inference'

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
    GOOGLE_API_KEY,
    HUGGINGFACE_API_KEY
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

// Initialize Hugging Face Inference for embeddings (768 dimensions to match database)
let hf: HfInference | null = null;
if (HUGGINGFACE_API_KEY) {
    hf = new HfInference(HUGGINGFACE_API_KEY);
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
        
        // Extract text from UIMessage parts array
        const getMessageText = (msg: any) => {
            if (msg.content) return msg.content // Support old format
            if (msg.parts) {
                const textParts = msg.parts.filter((part: any) => part.type === 'text')
                return textParts.map((part: any) => part.text || '').join('')
            }
            return ''
        }
        
        const latestMessage = getMessageText(messages[messages?.length-1])
        console.log('Latest message:', latestMessage)
        
        let docContext = ""

        // Get embedding from Hugging Face (768 dimensions to match database)
        console.log('Getting embedding from Hugging Face...')
        let embeddingArray: number[] = []
        try {
            if (!hf) {
                throw new Error('Hugging Face API key not configured')
            }
            // Using BAAI/bge-base-en-v1.5 which outputs 768 dimensions (matches database)
            const embedding = await hf.featureExtraction({
                model: 'BAAI/bge-base-en-v1.5',
                inputs: latestMessage,
            })
            
            // Convert to array format (Hugging Face returns nested arrays)
            embeddingArray = Array.isArray(embedding) && Array.isArray(embedding[0]) 
                ? embedding[0] as number[]
                : embedding as number[]
            
            // Ensure it's exactly 768 dimensions
            if (embeddingArray.length !== 768) {
                console.warn(`Expected 768 dimensions, got ${embeddingArray.length}. Truncating or padding.`)
                if (embeddingArray.length > 768) {
                    embeddingArray = embeddingArray.slice(0, 768)
                } else {
                    embeddingArray = [...embeddingArray, ...new Array(768 - embeddingArray.length).fill(0)]
                }
            }
            console.log('Got embedding, length:', embeddingArray.length)
        } catch (embedError: any) {
            console.error('Error getting embedding from Hugging Face:', embedError)
            // Fallback to empty array - will continue without RAG context
            console.warn('Continuing without RAG context due to embedding error')
            embeddingArray = []
        }

        try {
            console.log('Querying database with embedding...')
            if (!db || !ASTRA_DB_COLLECTION) {
                throw new Error('Database or collection not initialized');
            }
            // Only query if we have an embedding
            if (embeddingArray.length > 0) {
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
            } else {
                console.log('No embedding available, skipping vector search')
                docContext = ""
            }
        } catch(err) {
            console.error("Error querying db:", err)
            docContext = ""
        }

        // Format the conversation history for Gemini
        console.log('Formatting messages for Gemini...')
        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: getMessageText(msg) }]
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

        // Convert Gemini stream to ReadableStream<string>
        console.log('Creating streaming response...')
        const textStream = new ReadableStream<string>({
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
                                controller.enqueue(buffer + '\n'); 
                                buffer = ""; // Reset buffer after sending
                            }
                        }
                    }
        
                    // Send any remaining text in the buffer
                    if (buffer.trim().length > 0) {
                        controller.enqueue(buffer + '\n\n');
                    }
        
                    controller.close();
                    console.log('Stream completed successfully')
                } catch (error) {
                    console.error('Streaming error:', error);
                    controller.error(error);
                }
            }
        });
        
        console.log('Returning streaming response')
        return createTextStreamResponse({ textStream, headers: corsHeaders })
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