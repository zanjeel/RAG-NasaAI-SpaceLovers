import OpenAI from "openai"
import {OpenAIStream, StreamingTextResponse} from "ai"
import {DataAPIClient} from "@datastax/astra-db-ts"

const {
    ASTRA_DB_NAMESPACE, 
    ASTRA_DB_COLLECTION, 
    ASTRA_DB_API_ENDPOINT, 
    ASTRA_DB_APPLICATION_TOKEN, 
    OPENAI_API_KEY
} = process.env

const openai= new OpenAI({
    apiKey:OPENAI_API_KEY
})

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db= client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPACE})

export async function POST(req: Request){
try{
    const {messages} = await req.json()
    const latestMessage= messages[messages?.length-1]?.content
    let docContext=""

    const embedding = await openai.embeddings.create({
        model:"text-embedding-3-small",
        input:latestMessage,
        encoding_format:"float"
    })

    try{
        const collection= await db.collection(ASTRA_DB_COLLECTION)
        const cursor = collection.find(null,{
            sort:{
                $vector: embedding.data[0].embedding,
            },
            limit:10
        })

        const documents = await cursor.toArray()
        const docsMap= documents?.map(doc=>doc.text)
        docContext= JSON.stringify(docsMap)

    } catch(err){
        console.log("Error querying db...")
        docContext=""
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

    const response= await openai.chat.completions.create({
        model:"gpt-4",
        stream: true,
        messages:[template, ...messages]
    })

    const stream= OpenAIStream(response)
    return new StreamingTextResponse(stream)
} catch(err){
    throw err
}

}