import os 
from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def embed_chunks(chunks):
    result = client.models.embed_content(
        model = "gemini-embedding-001",
        contents = chunks
    )
    return [e.values for e in result.embeddings]

def embed_question(question):
    result = client.models.embed_content(model="gemini-embedding-001", contents=[question])
    return result.embeddings[0].values
    
# from sentence_transformers import SentenceTransformer

# model = SentenceTransformer('all-MiniLM-L6-v2')

# def embed_chunks(chunks):
#     return model.encode(chunks)