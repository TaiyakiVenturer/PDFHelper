from google import genai
from google.genai import types

client = genai.Client()
texts = [
    "What is the meaning of life?",
    "How much wood would a woodchuck chuck?",
    "How does the brain work?",
]
result = client.models.embed_content(
    model="gemini-embedding-001",
    contents=texts,
    config=types.EmbedContentConfig(output_dimensionality=10),
)
print(result.embeddings)