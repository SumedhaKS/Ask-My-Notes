from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os

from .ingest import extract_text, chunk_text, store_chunks
from .embed_utils import embed_chunks
from .retrieve import retrieve_chunks
from .generate import generate_answer

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_headers = ["*"],
    allow_methods = ["*"]
)

@app.get("/health-check")
def health_check():
    return {"message": "Good"}

@app.post("/upload")
async def upload_document(file: UploadFile = File(...)):
   temp_path = f"temp_{file.filename}"
   with open(temp_path, "wb") as buffer:
    shutil.copyfileobj(file.file, buffer)

   text = extract_text(temp_path)
   chunks = chunk_text(text)
   embeddings = embed_chunks(chunks)

   store_chunks(chunks, embeddings)

   os.remove(temp_path)
   return {"message": f"Stored {len(chunks)} chunks"}

@app.post("/ask")
async def ask_question(question: str):
    matches = retrieve_chunks(question)
    answer = generate_answer(question, matches)
    return {"answer": answer}

