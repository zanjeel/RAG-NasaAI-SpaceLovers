import {DataAPIClient} from "@datastax/astra-db-ts"
import {PuppeteerWebBaseLoader} from "langchain/document_loaders/web/puppeteer"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter"

import "dotenv/config"
type SimilarityMetric = "dot_product" | "cosine" | "euclidean"

const {
    ASTRA_DB_NAMESPACE, 
    ASTRA_DB_COLLECTION, 
    ASTRA_DB_API_ENDPOINT, 
    ASTRA_DB_APPLICATION_TOKEN, 
    GOOGLE_API_KEY
} = process.env

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY || '')

const eudata=[
    'https://en.wikipedia.org/wiki/List_of_NASA_missions',
    'https://en.wikipedia.org/wiki/NASA',
    'https://en.wikipedia.org/wiki/Artemis_program',
    'https://en.wikipedia.org/wiki/James_Webb_Space_Telescope',
    'https://en.wikipedia.org/wiki/Mars_2020',
    'https://en.wikipedia.org/wiki/SpaceX_Dragon',
    'https://en.wikipedia.org/wiki/International_Space_Station',
    'https://en.wikipedia.org/wiki/NASA_astronomical_data'
]

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, {namespace: ASTRA_DB_NAMESPACE})

const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:512,
    chunkOverlap:100
})

//waiting for db to load - using gemini dimension 768
const createCollection = async(SimilarityMetric: SimilarityMetric="dot_product")=>{
    try {
        // First try to delete the existing collection
        try {
            await db.dropCollection(ASTRA_DB_COLLECTION)
            console.log("Dropped existing collection:", ASTRA_DB_COLLECTION)
        } catch (dropError) {
            console.log("No existing collection to drop")
        }

        // Create new collection
        const res = await db.createCollection(ASTRA_DB_COLLECTION,{
            vector:{
                dimension: 768, // Gemini embeddings dimension
                metric:SimilarityMetric
            }
        })
        console.log("Created new collection:", res)
        return await db.collection(ASTRA_DB_COLLECTION)
    } catch (error) {
        console.error("Error setting up collection:", error)
        throw error
    }
}

//creating chunks to create embeddings from them and put in db
const loadSampleData= async() =>{
    const collection = await db.collection(ASTRA_DB_COLLECTION)
    const model = genAI.getGenerativeModel({ model: "embedding-001" })
    
    for await (const url of eudata){
        const content = await scrapePage(url)
        const chunks = await splitter.splitText(content)
        for await (const chunk of chunks){
            const embedding = await model.embedContent(chunk)
            
            // Convert the embedding to the correct format
            const vector = new Float32Array(768)
            const embeddingArray = Object.values(embedding.embedding)
            for (let i = 0; i < 768; i++) {
                vector[i] = embeddingArray[i]
            }
            
            const vectorBinary = {
                $binary: Buffer.from(vector.buffer).toString('base64')
            }
            
            const res = await collection.insertOne({
                $vector: vectorBinary,
                text: chunk,
                url: url,
                timestamp: new Date().toISOString()
            })
            console.log(res)
        }
    }
}

const scrapePage= async(url:string) =>{
    const loader= new PuppeteerWebBaseLoader(url,{
        launchOptions:{
            headless: true
        },
        gotoOptions:{
            waitUntil:"domcontentloaded"
        },
        evaluate: async(page, browser)=>{
          const result= await page.evaluate(()=> document.body.innerHTML)
          await browser.close()
          return result
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, '')
}

createCollection().then(()=> loadSampleData())
