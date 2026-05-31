from matching.dao.resume_dao import ResumeEmbeddingDAO
from matching.dao.job_dao import JobEmbeddingDAO
from matching.utils import generate_embedding

class EmbeddingService:
    @staticmethod
    def upsert_resume_embedding(resume_id, seeker_id, raw_text):
        vector = generate_embedding(raw_text)
        emb, _ = ResumeEmbeddingDAO.update_or_create(resume_id, seeker_id, vector)
        return emb

    @staticmethod
    def upsert_job_embedding(job_id, description_text):
        vector = generate_embedding(description_text)
        emb, _ = JobEmbeddingDAO.update_or_create(job_id, vector)
        return emb
