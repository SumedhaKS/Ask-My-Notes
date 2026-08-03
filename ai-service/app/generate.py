import os
from google import genai
from dotenv import load_dotenv
import time 

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

MODEL_FALLBACKS = ["gemini-3.5-flash-lite", "gemini-3.5-flash", "gemini-3.6-flash"]

def generate_answer(question, context_chunks):
    context = "\n\n".join(context_chunks)
    prompt = f"""Answer the question using only the context below.
            If the answer isn't in the context, say you don't know.
            Context: 
            {context}

            Question: {question}

            Answer: """
    
    last_error = None
    for model_name in MODEL_FALLBACKS:
        for attempt in range(2):
            try:
                print("trying: ", model_name)
                response = client.models.generate_content(model= model_name,contents=prompt)
                return response.text
            except Exception as e:
                last_error = e
                error_text = str(e).lower()
                if("unvailable") in error_text or "overload" in error_text or "high demand" in error_text:
                    time.sleep(1 * (attempt+1))
                    continue
                raise
                
    raise last_error

# from retrieve import retrieve_chunks
# question = "What is thermodynamics?"
# matches = retrieve_chunks(question)
# answer = generate_answer(question, matches)
# print(f"Answer: {answer}")
