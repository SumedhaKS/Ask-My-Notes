import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

def generate_answer(question, context_chunks):
    context = "\n\n".join(context_chunks)
    prompt = f"""Answer the question using only the context below.
            If the answer isn't in the context, say you don't know.
            Context: 
            {context}

            Question: {question}

            Answer: """
    
    response = client.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt
        )

    return response.text


# from retrieve import retrieve_chunks
# question = "What is thermodynamics?"
# matches = retrieve_chunks(question)
# answer = generate_answer(question, matches)
# print(f"Answer: {answer}")
