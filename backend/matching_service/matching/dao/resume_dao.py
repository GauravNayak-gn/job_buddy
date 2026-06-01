from matching.models import ResumeEmbedding
from pgvector.django import CosineDistance

class ResumeEmbeddingDAO:
    @staticmethod
    def update_or_create(resume_id, seeker_id, embedding):
        return ResumeEmbedding.objects.update_or_create(
            resume_id=resume_id,
            defaults={'seeker_id': seeker_id, 'embedding': embedding}
        )

    @staticmethod
    def get_by_seeker_and_resume(seeker_id, resume_id=None):
        if resume_id:
            resume = ResumeEmbedding.objects.filter(seeker_id=seeker_id, resume_id=resume_id).first()
            if resume:
                return resume
        return ResumeEmbedding.objects.filter(seeker_id=seeker_id).order_by('-updated_at').first()

    @staticmethod
    def get_matches_for_job(job_vec, limit=10):
        return ResumeEmbedding.objects.annotate(
            distance=CosineDistance('embedding', job_vec)
        ).order_by('distance')[:limit]
