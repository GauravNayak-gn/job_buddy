from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from matching.services.embedding_service import EmbeddingService

class UpsertResumeEmbeddingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        resume_id = request.data.get('resume_id')
        seeker_id = request.data.get('seeker_id')
        raw_text = request.data.get('raw_text', '')

        if not resume_id or not seeker_id:
            return Response({'error': 'resume_id and seeker_id are required.'}, status=400)

        emb = EmbeddingService.upsert_resume_embedding(resume_id, seeker_id, raw_text)
        return Response({'message': 'Resume embedding saved.', 'id': str(emb.id)})

class UpsertJobEmbeddingView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        job_id = request.data.get('job_id')
        description_text = request.data.get('description_text', '')

        if not job_id:
            return Response({'error': 'job_id is required.'}, status=400)

        emb = EmbeddingService.upsert_job_embedding(job_id, description_text)
        return Response({'message': 'Job embedding saved.', 'id': str(emb.id)})
