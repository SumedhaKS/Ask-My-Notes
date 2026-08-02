from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
import shutil
import os
from pydantic import BaseModel
from fastapi import HTTPException, Header, Depends

from .ingest import extract_text, chunk_text, store_chunks
from .embed_utils import embed_chunks
from .retrieve import retrieve_chunks
from .generate import generate_answer

app = FastAPI()

PDF_MAGIC_BYTES = b"%PDF-"
INTERNAL_API_KEY = os.getenv("INTERNAL_API_KEY")

app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_headers = ["*"],
    allow_methods = ["*"]
)

@app.get("/health-check")
def health_check():
    return {"message": "Good"}

async def verify_internal_key(x_internal_key: str = Header(...)):
    if x_internal_key != INTERNAL_API_KEY:
        raise HTTPException(status_code = 403, detail= "Forbidden")

@app.post("/upload")
async def upload_document(document_id: str= Form(...) ,file: UploadFile = File(...), _:None = Depends(verify_internal_key)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    header = await file.read(5)

    await file.seek(0)

    if header != PDF_MAGIC_BYTES:
        raise HTTPException(status_code=400, detail="File is not valid PDF")

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
     shutil.copyfileobj(file.file, buffer)

    text = extract_text(temp_path)
    chunks = chunk_text(text)
    embeddings = embed_chunks(chunks)

    store_chunks(chunks, embeddings, document_id)

    os.remove(temp_path)
    return {"message": f"Stored {len(chunks)} chunks"}

class AskRequest(BaseModel):
    question: str
    document_id: str

@app.post("/ask")
async def ask_question(body: AskRequest):
    print("Inside")
    matches = retrieve_chunks(body.question, body.document_id)
    answer = generate_answer(body.question, matches)
    return {"answer": answer}

# todo: While deploying, deploy as a "Private service"