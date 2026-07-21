from .embed_utils import model
from .db_utils import collection

def retrieve_chunks(question, top_k=3):
    question_embedding = model.encode([question])
    results = collection.query(
        query_embeddings=question_embedding.tolist(),
        n_results=top_k
    )
    return results["documents"][0]
