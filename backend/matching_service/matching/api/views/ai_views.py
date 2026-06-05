import logging
from django.db import connection
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny

from matching.utils import generate_embedding
from matching.models import JobEmbedding, ResumeEmbedding
from pgvector.django import CosineDistance
from matching.services.ai_service import AiService

logger = logging.getLogger(__name__)

class AiAlignmentReviewView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        seeker_id = request.query_params.get('seeker_id')
        job_id = request.query_params.get('job_id')

        if not seeker_id or not job_id:
            return Response({'error': 'seeker_id and job_id are required parameters.'}, status=400)

        # 1. Fetch Seeker Profile (Cross-Schema)
        seeker_data = {
            "first_name": "Candidate",
            "last_name": "",
            "summary": "",
            "current_title": "",
            "skills": [],
            "experiences": []
        }
        resume_text = ""

        try:
            with connection.cursor() as cursor:
                # Query seeker profile by id or user_id
                cursor.execute(
                    "SELECT id, user_id, first_name, last_name, summary, current_title FROM profile_schema.seeker_profiles WHERE id = %s OR user_id = %s LIMIT 1",
                    [seeker_id, seeker_id]
                )
                row = cursor.fetchone()
                if row:
                    profile_id, user_id, first_name, last_name, summary, current_title = row
                    seeker_data.update({
                        "first_name": first_name,
                        "last_name": last_name,
                        "summary": summary or "",
                        "current_title": current_title or ""
                    })

                    # Query skills
                    cursor.execute(
                        "SELECT s.name, ss.years_of_experience FROM profile_schema.seeker_skills ss "
                        "JOIN profile_schema.skills s ON ss.skill_id = s.id WHERE ss.seeker_id = %s",
                        [profile_id]
                    )
                    seeker_data["skills"] = [
                        {"skill_name": r[0], "years_of_experience": r[1]}
                        for r in cursor.fetchall()
                    ]

                    # Query experiences
                    cursor.execute(
                        "SELECT role_title, company_name, description FROM profile_schema.experiences WHERE seeker_id = %s",
                        [profile_id]
                    )
                    seeker_data["experiences"] = [
                        {"role_title": r[0], "company_name": r[1], "description": r[2] or ""}
                        for r in cursor.fetchall()
                    ]

                    # Query raw resume text (primary or most recent)
                    cursor.execute(
                        "SELECT raw_text FROM profile_schema.resumes WHERE seeker_id = %s ORDER BY is_primary DESC, updated_at DESC LIMIT 1",
                        [profile_id]
                    )
                    res_row = cursor.fetchone()
                    if res_row:
                        resume_text = res_row[0] or ""

        except Exception as e:
            logger.error(f"Error fetching seeker profile data cross-schema: {str(e)}")

        # 2. Fetch Job Details (Cross-Schema)
        job_data = {
            "title": "Selected Job",
            "description": "",
            "location_type": "Remote",
            "location_city": "",
            "experience_required": ""
        }

        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT title, description, location_type, location_city, experience_required FROM job_schema.jobs WHERE id = %s",
                    [job_id]
                )
                row = cursor.fetchone()
                if row:
                    title, description, location_type, location_city, experience_required = row
                    job_data.update({
                        "title": title,
                        "description": description or "",
                        "location_type": location_type,
                        "location_city": location_city or "",
                        "experience_required": experience_required or ""
                    })
        except Exception as e:
            logger.error(f"Error fetching job details cross-schema: {str(e)}")

        # 3. Call AI Service to perform review
        review_result = AiService.generate_alignment_review(
            seeker_data=seeker_data,
            resume_text=resume_text,
            job_data=job_data
        )

        return Response(review_result)


class AiChatbotView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        message = request.data.get('message', '').strip()
        chat_history = request.data.get('chat_history', [])

        if not message:
            return Response({'error': 'message is required.'}, status=400)

        context_data = []

        # RAG implementation: If the message looks like a job search or inquiry, search job embeddings
        low_message = message.lower()
        if any(keyword in low_message for keyword in ['job', 'work', 'position', 'hiring', 'role', 'developer', 'engineer', 'manager', 'design', 'intern']):
            try:
                # Generate query embedding
                query_vector = generate_embedding(message)
                
                # Fetch top 3 job matches semantically using pgvector
                matches = JobEmbedding.objects.annotate(
                    distance=CosineDistance('embedding', query_vector)
                ).order_by('distance')[:3]

                for m in matches:
                    score = round(1 - float(m.distance), 4)
                    # Include reasonably relevant semantic hits
                    if score > 0.15:
                        with connection.cursor() as cursor:
                            cursor.execute(
                                "SELECT title, description, location_type, location_city, salary_min, salary_max FROM job_schema.jobs WHERE id = %s",
                                [m.job_id]
                            )
                            job = cursor.fetchone()
                            if job:
                                title, desc, loc_type, loc_city, s_min, s_max = job
                                desc_preview = desc[:200] + "..." if len(desc) > 200 else desc
                                loc = f"{loc_city} ({loc_type})" if loc_city else loc_type
                                salary = f"{s_min} - {s_max}" if s_min and s_max else "Not specified"
                                context_data.append(
                                    f"Job Title: {title} | Location: {loc} | Salary: {salary} | Match Strength: {score * 100:.1f}% | Description Snippet: {desc_preview}"
                                )
            except Exception as e:
                logger.error(f"Error performing semantic search for RAG context: {str(e)}")

        # Call AI Service for RAG response
        ai_reply = AiService.generate_chatbot_response(
            user_query=message,
            chat_history=chat_history,
            context_data=context_data
        )

        return Response({'reply': ai_reply})
