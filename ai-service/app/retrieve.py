from .embed_utils import embed_question
from .db_utils import collection

def retrieve_chunks(question, document_id, top_k=3):
    question_embedding = embed_question(question)
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
        where = {"document_id": document_id}
    )
    return results["documents"][0]
