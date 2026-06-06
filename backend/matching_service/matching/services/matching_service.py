from matching.dao.resume_dao import ResumeEmbeddingDAO
from matching.dao.job_dao import JobEmbeddingDAO
from matching.services.redis_client import RedisClient

class MatchingService:
    @staticmethod
    def get_jobs_for_seeker(seeker_id, resume_id=None):
        cache_key = f"matches:seeker:{seeker_id}"
        if resume_id:
            cache_key = f"matches:seeker:{seeker_id}:{resume_id}"
            
        cached = RedisClient.get(cache_key)
        if cached is not None:
            return cached

        resume = ResumeEmbeddingDAO.get_by_seeker_and_resume(seeker_id, resume_id)
        if not resume:
            return []
        
        matches = JobEmbeddingDAO.get_matches_for_seeker(resume.embedding, limit=10)
        results = [
            {'job_id': str(m.job_id), 'similarity_score': round(1 - float(m.distance), 4)}
            for m in matches
        ]
        RedisClient.set(cache_key, results, timeout=3600)  # Cache for 1 hour
        return results

    @staticmethod
    def get_seekers_for_job(job_id):
        cache_key = f"matches:job:{job_id}"
        cached = RedisClient.get(cache_key)
        if cached is not None:
            return cached

        job = JobEmbeddingDAO.get_by_job_id(job_id)
        if not job:
            return []
            
        matches = ResumeEmbeddingDAO.get_matches_for_job(job.embedding, limit=10)
        results = [
            {
                'seeker_id': str(m.seeker_id),
                'resume_id': str(m.resume_id),
                'similarity_score': round(1 - float(m.distance), 4),
            }
            for m in matches
        ]
        RedisClient.set(cache_key, results, timeout=3600)  # Cache for 1 hour
        return results

