from matching.models import JobEmbedding
from pgvector.django import CosineDistance

class JobEmbeddingDAO:
    @staticmethod
    def update_or_create(job_id, embedding):
        return JobEmbedding.objects.update_or_create(
            job_id=job_id,
            defaults={'embedding': embedding}
        )

    @staticmethod
    def get_by_job_id(job_id):
        return JobEmbedding.objects.filter(job_id=job_id).first()

    @staticmethod
    def get_matches_for_seeker(seeker_vec, limit=10):
        return JobEmbedding.objects.annotate(
            distance=CosineDistance('embedding', seeker_vec)
        ).order_by('distance')[:limit]
