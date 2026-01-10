import { createTextStreamResponse } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"
import { NextResponse } from 'next/server'
import { HfInference } from '@huggingface/inference'
import Groq from 'groq-sdk'

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
    HUGGINGFACE_API_KEY,
    GROQ_API_KEY
} = process.env

// Log environment variables (without sensitive data)
console.log('Environment check:', {
    hasApiEndpoint: !!ASTRA_DB_API_ENDPOINT,
    hasNamespace: !!ASTRA_DB_NAMESPACE,
    hasCollection: !!ASTRA_DB_COLLECTION,
    hasToken: !!ASTRA_DB_APPLICATION_TOKEN,
    hasHuggingFaceKey: !!HUGGINGFACE_API_KEY,
    hasGroqKey: !!GROQ_API_KEY,
    apiEndpoint: ASTRA_DB_API_ENDPOINT?.substring(0, 20) + '...' // Log first 20 chars only
})

// Validate environment variables
function validateEnv() {
    console.log('Validating environment variables...')
    if (!HUGGINGFACE_API_KEY) {
        console.error('Missing HUGGINGFACE_API_KEY')
        return NextResponse.json({ error: 'HUGGINGFACE_API_KEY is not set in environment variables' }, { status: 500, headers: corsHeaders })
    }

    if (!GROQ_API_KEY) {
        console.error('Missing GROQ_API_KEY')
        return NextResponse.json({ error: 'GROQ_API_KEY is not set in environment variables' }, { status: 500, headers: corsHeaders })
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

// Initialize Hugging Face Inference for embeddings only
let hf: HfInference | null = null;
if (HUGGINGFACE_API_KEY) {
    hf = new HfInference(HUGGINGFACE_API_KEY);
}

// Initialize Groq for text generation
let groq: Groq | null = null;
if (GROQ_API_KEY) {
    groq = new Groq({
        apiKey: GROQ_API_KEY,
    });
}

// Groq model (free tier compatible, fast inference)
const GROQ_MODEL = "llama-3.1-8b-instant" // Fast, free tier compatible model

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

        if (!hf) {
            return NextResponse.json({ error: 'Hugging Face AI not initialized' }, { status: 500, headers: corsHeaders })
        }

        if (!groq) {
            return NextResponse.json({ error: 'Groq AI not initialized' }, { status: 500, headers: corsHeaders })
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
                console.log('✅ Vector DB query successful! Found documents:', documents.length)
                if (documents.length > 0) {
                    console.log('📄 First document preview:', documents[0].text?.substring(0, 100) + '...')
                }
                const docsMap = documents?.map(doc => doc.text)
                docContext = JSON.stringify(docsMap)
                console.log('📊 RAG context length:', docContext.length, 'characters')
            } else {
                console.log('No embedding available, skipping vector search')
                docContext = ""
            }
        } catch(err: any) {
            console.error("❌ Error querying db:", err)
            console.error("❌ DB Error details:", {
                message: err.message,
                code: err.code,
                name: err.name
            })
            console.warn("⚠️ Falling back to general knowledge (no RAG context)")
            docContext = ""
        }

        // Format messages for Groq chat API
        console.log('Formatting messages for Groq...')
        
        // Build the system prompt
        const systemPrompt = `You are a funny, space nerd who knows everything about NASA. You must know their recent space exploration missions and latest space news. The context will provide you with data from the NASA Wikipedia Websites. If the context doesn't include the information you need, answer based on your existing knowledge.

Format your responses as follows:
1. Break information into clear, concise paragraphs but keep them fun and nerdy.
2. Each paragraph should be 3-5 lines maximum.
3. Use 2 line spacing between paragraphs.
4. Do not use asterisks or markdown formatting or images.
5. Use simple, clear language.
6. Keep sentences short and direct but nerdy.`

        // Format messages for Groq chat API
        const groqMessages: Array<{role: 'system' | 'user' | 'assistant', content: string}> = []
        
        // Add system message with context
        let systemContent = systemPrompt
        let ragStatus = "none"
        if (docContext && docContext.length > 2) { // Check for actual content (not just "[]")
            console.log('✅ Using RAG context in prompt')
            console.log('📊 RAG context preview:', docContext.substring(0, 200) + '...')
            ragStatus = "active"
            systemContent += `\n\nContext from NASA Wikipedia:\n${docContext}`
        } else {
            console.warn('⚠️ No RAG context available - using general knowledge only')
            ragStatus = "fallback"
        }
        groqMessages.push({ role: 'system', content: systemContent })
        
        // Add conversation history
        for (let i = 0; i < messages.length - 1; i++) {
            const msg = messages[i]
            const text = getMessageText(msg)
            groqMessages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: text
            })
        }
        
        // Add current user message
        groqMessages.push({ role: 'user', content: latestMessage })

        console.log('Sending to Groq model:', GROQ_MODEL)
        
        // Use Groq for text generation with streaming
        const textStream = new ReadableStream<string>({
            async start(controller) {
                try {
                    // Use Groq chat completions with streaming
                    console.log('Calling Groq chat completions...')
                    const stream = await groq!.chat.completions.create({
                        model: GROQ_MODEL,
                        messages: groqMessages,
                        temperature: 0.7,
                        max_tokens: 1024,
                        stream: true
                    })
                    
                    // Stream the response
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || ''
                        if (content) {
                            controller.enqueue(content)
                        }
                    }
                    
                    controller.close()
                    console.log('Stream completed successfully')
                } catch (error: any) {
                    console.error('Streaming error:', error)
                    console.error('Error details:', {
                        message: error.message,
                        stack: error.stack,
                        name: error.name
                    })
                    // Try to send error message before closing
                    try {
                        controller.enqueue(`\n\nError: ${error.message || 'Unknown error occurred'}`)
                        controller.close()
                    } catch (closeError) {
                        // If we can't close properly, just log it
                        console.error('Error closing stream:', closeError)
                    }
                }
            }
        })
        
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
        
        if (err.message?.includes('API key') || err.message?.includes('401') || err.message?.includes('Unauthorized')) {
            return NextResponse.json({ 
                error: 'Invalid API key. Please check your HUGGINGFACE_API_KEY environment variable.',
                details: err.message 
            }, { status: 401, headers: corsHeaders })
        }

        return NextResponse.json({ 
            error: 'Internal server error',
            details: err.message 
        }, { status: 500, headers: corsHeaders })
    }
}