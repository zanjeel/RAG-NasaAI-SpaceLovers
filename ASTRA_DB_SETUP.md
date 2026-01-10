# How to Recreate Your Astra DB Database

## Step 1: Create New Database in Astra DB

1. **Go to Astra DB**: https://astra.datastax.com/
2. **Log in** to your account
3. **Click "Create Database"** button
4. **Fill in the form**:
   - **Database Name**: `nasa-rag-db` (or any name you prefer)
   - **Provider**: Choose AWS, GCP, or Azure (AWS is usually fastest)
   - **Region**: Choose closest to you (e.g., `us-east-1` or `us-east-2`)
   - **Database Type**: Select "Vector" or "Serverless"
   - **Keyspace**: Use default (`default_keyspace`) or create a new one
5. **Click "Create Database"**
6. **Wait 2-5 minutes** for database to be created (status will show "Active")

## Step 2: Get Your Credentials

Once the database is **Active**:

1. **Click on your database** to open it
2. **Go to "Connect" tab** (or "Database Details")
3. **Copy these values**:
   - **API Endpoint**: Looks like `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-xxxx-xxxx-xxxx.apps.astra.datastax.com`
     - ⚠️ **Important**: Copy WITHOUT `https://` prefix (just the hostname)
   - **Application Token**: Click "Generate Token" → Copy the token (starts with `AstraCS:...`)
   - **Keyspace/Namespace**: Usually `default_keyspace` (check in database details)

## Step 3: Update Your .env File

Update your `.env` file with the new credentials:

```env
ASTRA_DB_API_ENDPOINT="your-new-endpoint-here.apps.astra.datastax.com"
ASTRA_DB_APPLICATION_TOKEN="AstraCS:your-token-here"
ASTRA_DB_NAMESPACE="default_keyspace"
ASTRA_DB_COLLECTION="eugpt"
HUGGINGFACE_API_KEY="your-huggingface-key"
GROQ_API_KEY="your-groq-key"
```

**⚠️ Important Notes**:
- Endpoint should NOT include `https://` - just the hostname
- No spaces around the `=` sign
- Use quotes around values that might contain special characters

## Step 4: Populate the Database

You have **TWO OPTIONS** to populate your database:

### Option A: Using the loadDb.ts Script (Requires Google API Key)

**⚠️ Note**: This script uses Google Gemini for embeddings (not Hugging Face). You'll need a `GOOGLE_API_KEY`.

1. Add `GOOGLE_API_KEY` to your `.env` file
2. Run:
   ```bash
   npm run seed
   ```
   
   This will:
   - Create the collection
   - Scrape NASA Wikipedia pages
   - Generate embeddings using Gemini
   - Store them in the database

### Option B: Create Collection Manually (Recommended - No Google API needed)

Since you're using Hugging Face embeddings in production, you can create an empty collection now and populate it later if needed.

The collection will be created automatically when you first query it, OR you can create it manually using Astra DB's web interface.

**Collection Settings**:
- **Collection Name**: `eugpt`
- **Vector Dimension**: `768` (matches Hugging Face BAAI/bge-base-en-v1.5)
- **Similarity Metric**: `dot_product` or `cosine`

## Step 5: Test the Connection

1. **Restart your dev server**:
   ```bash
   npm run dev
   ```

2. **Check the logs** when the server starts:
   - Should see: `DB connection successful`
   - No ENOTFOUND errors

3. **Send a test message** in your chat
4. **Check server logs** for:
   - `✅ Vector DB query successful!` (if collection exists with data)
   - OR `⚠️ No RAG context available` (if collection is empty - this is OK for now)

## Troubleshooting

- **ENOTFOUND error**: Check that endpoint doesn't have `https://` prefix
- **Authentication error**: Regenerate Application Token in Astra DB
- **Collection not found**: Collection will be created on first query, or create manually
- **Empty results**: This is normal if you haven't populated the database yet

## Next Steps

Once the database is connected:
- Your RAG system will work, but queries will return empty results until you populate the database
- You can populate it later using the `loadDb.ts` script (requires Google API key)
- OR build a new script using Hugging Face embeddings to match your production setup

