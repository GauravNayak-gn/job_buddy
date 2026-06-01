from matching.dao.resume_dao import ResumeEmbeddingDAO
from matching.dao.job_dao import JobEmbeddingDAO

class MatchingService:
    @staticmethod
    def get_jobs_for_seeker(seeker_id, resume_id=None):
        resume = ResumeEmbeddingDAO.get_by_seeker_and_resume(seeker_id, resume_id)
        if not resume:
            return []
        
        matches = JobEmbeddingDAO.get_matches_for_seeker(resume.embedding, limit=10)
        return [
            {'job_id': str(m.job_id), 'similarity_score': round(1 - float(m.distance), 4)}
            for m in matches
        ]

    @staticmethod
    def get_seekers_for_job(job_id):
        job = JobEmbeddingDAO.get_by_job_id(job_id)
        if not job:
            return []
            
        matches = ResumeEmbeddingDAO.get_matches_for_job(job.embedding, limit=10)
        return [
            {
                'seeker_id': str(m.seeker_id),
                'resume_id': str(m.resume_id),
                'similarity_score': round(1 - float(m.distance), 4),
            }
            for m in matches
        ]
