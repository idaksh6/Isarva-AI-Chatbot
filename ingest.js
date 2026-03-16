const { CheerioWebBaseLoader } = require("langchain/document_loaders/web/cheerio");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { OpenAIEmbeddings } = require("@langchain/openai");
const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

async function ingest() {
  const url = process.env.WEBSITE_URL || "https://example.com"; // Replace with your website
  console.log(`Starting ingestion for: ${url}`);

  try {
    // 1. Load data from website
    const loader = new CheerioWebBaseLoader(url);
    const docs = await loader.load();
    console.log(`Loaded ${docs.length} documents`);

    // 2. Split text into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.splitDocuments(docs);
    console.log(`Split into ${chunks.length} chunks`);

    // 3. Initialize Supabase client
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    
    if (!supabaseKey || !supabaseUrl) {
      throw new Error("Missing Supabase credentials in .env");
    }

    const client = createClient(supabaseUrl, supabaseKey);

    // 4. Initialize OpenAI Embeddings
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
    });

    // 5. Store in Supabase
    console.log("Creating vector store and uploading to Supabase...");
    await SupabaseVectorStore.fromDocuments(chunks, embeddings, {
      client,
      tableName: "documents",
      queryName: "match_documents",
    });

    console.log("Ingestion completed successfully!");
  } catch (error) {
    console.error("Ingestion failed:", error);
  }
}

ingest();
