from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import JobEmbedding, ResumeEmbedding
from .utils import cosine_similarity, generate_embedding, literal_to_vector, vector_to_literal


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'matching'})


class UpsertResumeEmbeddingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        resume_id = request.data.get('resume_id')
        seeker_id = request.data.get('seeker_id')
        raw_text = request.data.get('raw_text', '')

        if not resume_id or not seeker_id:
            return Response({'error': 'resume_id and seeker_id are required.'}, status=400)

        vector = generate_embedding(raw_text)
        emb, _ = ResumeEmbedding.objects.update_or_create(
            resume_id=resume_id,
            defaults={
                'seeker_id': seeker_id,
                'embedding': vector_to_literal(vector),
            },
        )
        return Response({'message': 'Resume embedding saved.', 'id': str(emb.id)})


class UpsertJobEmbeddingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        job_id = request.data.get('job_id')
        description_text = request.data.get('description_text', '')

        if not job_id:
            return Response({'error': 'job_id is required.'}, status=400)

        vector = generate_embedding(description_text)
        emb, _ = JobEmbedding.objects.update_or_create(
            job_id=job_id,
            defaults={'embedding': vector_to_literal(vector)},
        )
        return Response({'message': 'Job embedding saved.', 'id': str(emb.id)})


class JobsForSeekerView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, seeker_id):
        resume = ResumeEmbedding.objects.filter(seeker_id=seeker_id).order_by('-updated_at').first()
        if not resume:
            return Response({'results': []})

        seeker_vec = literal_to_vector(resume.embedding)
        results = []
        for job in JobEmbedding.objects.all():
            score = cosine_similarity(seeker_vec, literal_to_vector(job.embedding))
            results.append({'job_id': str(job.job_id), 'similarity_score': round(score, 4)})

        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        return Response({'results': results[:10]})


class SeekersForJobView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        try:
            job = JobEmbedding.objects.get(job_id=job_id)
        except JobEmbedding.DoesNotExist:
            return Response({'results': []})

        job_vec = literal_to_vector(job.embedding)
        results = []
        for resume in ResumeEmbedding.objects.all():
            score = cosine_similarity(job_vec, literal_to_vector(resume.embedding))
            results.append(
                {
                    'seeker_id': str(resume.seeker_id),
                    'resume_id': str(resume.resume_id),
                    'similarity_score': round(score, 4),
                }
            )

        results.sort(key=lambda x: x['similarity_score'], reverse=True)
        return Response({'results': results[:10]})
