import { GoogleGenerativeAI } from "@google/generative-ai"
import { StreamingTextResponse } from "ai"
import { DataAPIClient } from "@datastax/astra-db-ts"

const {
    ASTRA_DB_NAMESPACE, 
    ASTRA_DB_COLLECTION, 
    ASTRA_DB_API_ENDPOINT, 
    ASTRA_DB_APPLICATION_TOKEN, 
    GOOGLE_API_KEY
} = process.env

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || '')
const model = genAI.getGenerativeModel({ model: "gemini-pro" })

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPACE})

export async function POST(req: Request){
    try {
        const {messages} = await req.json()
        const latestMessage = messages[messages?.length-1]?.content
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

        const template = {
            role: "system",
            content: `You are a funny, space nerd who knows everything
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
        }

        const result = await model.generateContentStream([
            template.content,
            ...messages.map(m => m.content)
        ])

        // Convert Gemini stream to ReadableStream
        const stream = new ReadableStream({
            async start(controller) {
                for await (const chunk of result.stream) {
                    controller.enqueue(chunk.text())
                }
                controller.close()
            }
        })

        return new StreamingTextResponse(stream)
    } catch(err) {
        throw err
    }
}