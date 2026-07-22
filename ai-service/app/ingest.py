from pypdf import PdfReader
from .db_utils import collection

def extract_text(pdf_path):
    reader = PdfReader(pdf_path)
    full_text = ""
    for page in reader.pages:
        full_text += page.extract_text()
    return full_text

def chunk_text(text, chunk_size=300, overlap=50):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        start += chunk_size - overlap

    return chunks

def store_chunks(chunks, embeddings, document_id):
    ids = [f"{document_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = [{"document_id": document_id} for _ in chunks]
    collection.add(
        ids=ids,
        documents=chunks,
        embeddings = embeddings.tolist(),
        metadatas = metadatas
    )

