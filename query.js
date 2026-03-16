const { OpenAIEmbeddings, ChatOpenAI } = require("@langchain/openai");
const { SupabaseVectorStore } = require("@langchain/community/vectorstores/supabase");
const { createClient } = require("@supabase/supabase-js");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const { PromptTemplate } = require("@langchain/core/prompts");
const { RunnableSequence, RunnablePassthrough } = require("@langchain/core/runnables");
require("dotenv").config();

async function query() {
  const userQuestion = process.argv[2] || "What services do you offer?";
  console.log(`Question: ${userQuestion}`);

  try {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    const vectorStore = new SupabaseVectorStore(new OpenAIEmbeddings(), {
      client,
      tableName: "documents",
      queryName: "match_documents",
    });

    const retriever = vectorStore.asRetriever();

    const llm = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0.7,
    });

    const template = `
      Answer the user's question based ONLY on the following context provided. 
      If you don't know the answer from the context, say that you don't know, but don't make up an answer.
      Context: {context}
      
      Question: {question}
      
      Answer:
    `;

    const prompt = PromptTemplate.fromTemplate(template);

    const chain = RunnableSequence.from([
      {
        context: retriever.pipe((docs) => docs.map((d) => d.pageContent).join("\n")),
        question: new RunnablePassthrough(),
      },
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    console.log("Searching for answer...");
    const result = await chain.invoke(userQuestion);

    console.log("\n--- RESPONSE ---");
    console.log(result);
    console.log("----------------\n");

  } catch (error) {
    console.error("Query failed:", error);
  }
}

query();
