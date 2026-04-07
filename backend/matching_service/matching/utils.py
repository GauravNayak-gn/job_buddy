import hashlib
import math


def vector_to_literal(vector):
    return '[' + ','.join(f'{x:.6f}' for x in vector) + ']'


def literal_to_vector(literal):
    raw = literal.strip().lstrip('[').rstrip(']')
    if not raw:
        return []
    return [float(x) for x in raw.split(',')]


def deterministic_embedding(text, dim=384):
    text = text or ''
    values = []
    for i in range(dim):
        seed = f'{text}-{i}'.encode('utf-8')
        digest = hashlib.sha256(seed).hexdigest()
        number = int(digest[:8], 16)
        values.append((number % 10000) / 10000.0)
    return values


def generate_embedding(text):
    try:
        from sentence_transformers import SentenceTransformer

        model = SentenceTransformer('all-MiniLM-L6-v2')
        return model.encode(text or '', normalize_embeddings=True).tolist()
    except Exception:
        return deterministic_embedding(text)


def cosine_similarity(v1, v2):
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2))
    mag1 = math.sqrt(sum(a * a for a in v1))
    mag2 = math.sqrt(sum(b * b for b in v2))
    if mag1 == 0 or mag2 == 0:
        return 0.0
    return dot / (mag1 * mag2)
