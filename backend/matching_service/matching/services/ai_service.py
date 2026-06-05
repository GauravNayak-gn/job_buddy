import logging
import json
import requests
import google.generativeai as genai
from django.conf import settings

logger = logging.getLogger(__name__)

class AiService:
    _configured_gemini = False

    @classmethod
    def _configure_gemini(cls, api_key):
        if not cls._configured_gemini:
            if api_key and api_key != 'dummy_key_value':
                try:
                    genai.configure(api_key=api_key)
                    cls._configured_gemini = True
                    logger.info("Google Gemini SDK configured successfully.")
                except Exception as e:
                    logger.error(f"Error configuring Gemini SDK: {str(e)}")
            else:
                logger.warning("Gemini API key is not set or has dummy value. AI responses will be simulated.")

    @classmethod
    def generate_alignment_review(cls, seeker_data, resume_text, job_data):
        """
        Generates an alignment review comparing seeker details/resume vs. job details.
        Returns a dictionary containing: score, strengths, gaps, seekerRecommendation, recruiterPitch, interviewQuestions.
        Supports Gemini and OpenAI-compatible endpoints (OpenAI, OpenRouter, OpenCode, DeepSeek, local models, etc.).
        """
        provider = getattr(settings, 'AI_PROVIDER', 'gemini').lower()
        api_key = getattr(settings, 'AI_API_KEY', '')
        api_base = getattr(settings, 'AI_API_BASE', 'https://api.openai.com/v1')
        model_name = getattr(settings, 'AI_MODEL_NAME', 'gemini-2.5-flash')

        # Prepare content representations
        skills_formatted = ', '.join([
            f"{s.get('skill_name', '')} ({s.get('years_of_experience', 0)}y)"
            for s in seeker_data.get('skills', [])
        ])

        seeker_info = f"""
Name: {seeker_data.get('first_name', '')} {seeker_data.get('last_name', '')}
Current Title: {seeker_data.get('current_title', '')}
Summary: {seeker_data.get('summary', '')}
Skills: {skills_formatted}
Experiences:
"""
        for exp in seeker_data.get('experiences', []):
            seeker_info += f"- {exp.get('role_title', '')} at {exp.get('company_name', '')}: {exp.get('description', '')}\n"

        if resume_text:
            seeker_info += f"\nRaw Resume Text Extracted:\n{resume_text[:2000]}\n"

        job_info = f"""
Title: {job_data.get('title', '')}
Description: {job_data.get('description', '')}
Location: {job_data.get('location_type', '')} ({job_data.get('location_city', 'Remote')})
Experience Required: {job_data.get('experience_required', '')}
"""

        system_instruction = """
You are a senior recruiter and talent acquisition expert. Analyze the Candidate Profile against the Job Description.
Evaluate alignment, calculate an exact match score (0-100), identify strengths, highlight gaps, write seeker recommendation, recruiter pitch, and draft interview questions.
You MUST respond with a JSON object. No other text or markdown code fences outside the JSON.
JSON Keys:
- "score": integer match score from 0 to 100
- "strengths": array of 2-3 bullet points highlighting matching skills or experiences
- "gaps": array of 2-3 bullet points highlighting areas of experience or skill gap
- "seekerRecommendation": 1-2 sentences of advice to the candidate on how to improve their application
- "recruiterPitch": 1-2 sentences pitching this candidate to a hiring manager, or describing the fit
- "interviewQuestions": array of 2-3 custom interview questions to test the gaps
"""

        prompt = f"""
[SYSTEM INSTRUCTION]
{system_instruction}

[CANDIDATE PROFILE]
{seeker_info}

[JOB DESCRIPTION]
{job_info}
"""

        if api_key and api_key != 'dummy_key_value':
            # ── 1. Google Gemini Provider ───────────────────────────
            if provider == 'gemini':
                cls._configure_gemini(api_key)
                if cls._configured_gemini:
                    try:
                        model = genai.GenerativeModel(model_name)
                        response = model.generate_content(
                            prompt,
                            generation_config={"response_mime_type": "application/json"}
                        )
                        result_json = json.loads(response.text.strip())
                        return result_json
                    except Exception as e:
                        logger.error(f"Error calling Gemini API for alignment review: {str(e)}")

            # ── 2. OpenAI / OpenRouter / OpenCode Provider ───────────
            elif provider == 'openai':
                try:
                    url = f"{api_base.rstrip('/')}/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": system_instruction},
                            {"role": "user", "content": prompt}
                        ],
                        "response_format": {"type": "json_object"}
                    }
                    response = requests.post(url, json=payload, headers=headers, timeout=25)
                    response.raise_for_status()
                    reply = response.json()['choices'][0]['message']['content'].strip()
                    return json.loads(reply)
                except Exception as e:
                    logger.error(f"Error calling OpenAI-compatible API for alignment review: {str(e)}")

        # Fallback simulated content (zero crash guarantee)
        return cls._fallback_alignment_review(seeker_data, job_data)

    @classmethod
    def generate_chatbot_response(cls, user_query, chat_history=None, context_data=None):
        """
        Generates a RAG-augmented chatbot response.
        Supports Gemini and OpenAI-compatible endpoints (OpenAI, OpenRouter, OpenCode, DeepSeek, local models, etc.).
        """
        provider = getattr(settings, 'AI_PROVIDER', 'gemini').lower()
        api_key = getattr(settings, 'AI_API_KEY', '')
        api_base = getattr(settings, 'AI_API_BASE', 'https://api.openai.com/v1')
        model_name = getattr(settings, 'AI_MODEL_NAME', 'gemini-2.5-flash')

        context_str = ""
        if context_data:
            context_str = "Here is some relevant context from our database:\n"
            for item in context_data:
                context_str += f"- {item}\n"

        history_str = ""
        if chat_history:
            for msg in chat_history[-6:]:
                role = "User" if msg.get('sender') == 'user' else "Assistant"
                history_str += f"{role}: {msg.get('text')}\n"

        system_prompt = """
You are "Job Buddy Assistant", a helpful, friendly AI chatbot for a job portal platform.
Use the provided Context Data to answer questions, recommend jobs, or explain candidate qualifications.
If the context contains lists of jobs, format them clearly using markdown.
If the query is general and the context doesn't specify, describe features of Job Buddy:
- Job seekers can upload PDF resumes, search jobs, get semantic similarity matches, and view detailed AI alignment reports.
- Recruiters can publish job roles, manage applications, and review AI summaries of applicants including custom interview questions.
Keep answers concise, direct, and professional.
"""

        prompt = f"""
[SYSTEM INSTRUCTION]
{system_prompt}

[CONTEXT DATA]
{context_str}

[CHAT HISTORY]
{history_str}

[USER QUERY]
{user_query}
"""

        if api_key and api_key != 'dummy_key_value':
            # ── 1. Google Gemini Provider ───────────────────────────
            if provider == 'gemini':
                cls._configure_gemini(api_key)
                if cls._configured_gemini:
                    try:
                        model = genai.GenerativeModel(model_name)
                        response = model.generate_content(prompt)
                        return response.text.strip()
                    except Exception as e:
                        logger.error(f"Error calling Gemini API for chatbot: {str(e)}")

            # ── 2. OpenAI / OpenRouter / OpenCode Provider ───────────
            elif provider == 'openai':
                try:
                    url = f"{api_base.rstrip('/')}/chat/completions"
                    headers = {
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json"
                    }
                    payload = {
                        "model": model_name,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt}
                        ]
                    }
                    response = requests.post(url, json=payload, headers=headers, timeout=25)
                    response.raise_for_status()
                    reply = response.json()['choices'][0]['message']['content'].strip()
                    return reply
                except Exception as e:
                    logger.error(f"Error calling OpenAI-compatible API for chatbot: {str(e)}")

        # Fallback keyword response
        return cls._fallback_chatbot_response(user_query, context_data)

    @classmethod
    def _fallback_alignment_review(cls, seeker_data, job_data):
        """Generates realistic structured fallback mock data when Gemini is not configured or fails"""
        job_title = job_data.get('title', '').lower()
        
        if 'angular' in job_title or 'frontend' in job_title:
            return {
                "score": 92,
                "strengths": [
                    "Excellent command of Angular signals and template syntax.",
                    "Strong UI/UX design skills with clean semantic markup.",
                    "Demonstrated history of refactoring complex dashboards."
                ],
                "gaps": [
                    "Lacks comprehensive Docker / containerized environment experience.",
                    "Limited exposure to writing unit tests for HTTP request interceptors."
                ],
                "seekerRecommendation": "Highlight your work on custom dashboard components and modular routing. Adding a brief section on how you deploy containers locally will cover the gaps.",
                "recruiterPitch": "A highly skilled Angular developer who is immediately productive. UI implementation is top-notch, though container devops needs slight mentoring.",
                "interviewQuestions": [
                    "How do you manage cross-origin proxy configurations in Angular dev environments?",
                    "What strategy do you use to split large feature bundles into lazy loaded routes?",
                    "Have you worked with container orchestration before, or just local Dockerfiles?"
                ]
            }
        elif 'python' in job_title or 'django' in job_title or 'backend' in job_title:
            return {
                "score": 64,
                "strengths": [
                    "Familiar with Python script writing.",
                    "Understands relational database schema layouts."
                ],
                "gaps": [
                    "Lacks advanced microservices messaging experience (Kafka / RabbitMQ).",
                    "No evidence of optimization/indexing skills for high latency queries.",
                    "Mainly focused on frontend layouts rather than scalable backend systems."
                ],
                "seekerRecommendation": "Consider completing a small Django backend project that integrates Redis and Kafka. Emphasize any SQL database configuration you have done in the past.",
                "recruiterPitch": "Mainly a frontend developer with conceptual python knowledge. Might require significant onboarding time to work on highly concurrent backend pipelines.",
                "interviewQuestions": [
                    "Explain how Kafka event listeners can trigger background celery tasks.",
                    "What measures would you take to fix high CPU utilization on a Django query endpoint?",
                    "Have you built custom REST APIs using Django Rest Framework?"
                ]
            }
        else:
            return {
                "score": 78,
                "strengths": [
                    "Well-structured resume summary and professional details.",
                    "Shows strong adaptable skill framework and coding practices."
                ],
                "gaps": [
                    "Missing specific technology credentials listed in the description.",
                    "No exact project examples matching the specific vertical domain."
                ],
                "seekerRecommendation": "Customize your summary paragraph on your resume to focus on the key requirements of this job. Link your github portfolio to display proof of work.",
                "recruiterPitch": "An adaptable, mid-level candidate with good foundations. Shows potential, but needs to prove domain-specific coding capabilities.",
                "interviewQuestions": [
                    "What project in your portfolio matches this job description the closest?",
                    "How do you adapt to new tech stacks when joining a new codebase?",
                    "Can you talk about a time you worked on a performance improvement task?"
                ]
            }

    @classmethod
    def _fallback_chatbot_response(cls, query, context_data):
        """Conversational fallback responses when Gemini is not configured or fails"""
        low = query.lower()
        if context_data:
            jobs_list = "\n".join([f"- {item}" for item in context_data])
            return f"I found the following matching records in our database:\n\n{jobs_list}\n\nLet me know if you want me to describe any of these in detail!"
        
        if 'job' in low or 'recommend' in low:
            return "Based on your search, we have several positions open including Senior Angular Developer and Django Python Engineer. You can search or view them under the 'Jobs' tab."
        elif 'apply' in low:
            return "To apply, simply go to the 'Jobs' tab, click on a job card, upload your resume from the profile page, and click 'Apply'."
        elif 'resume' in low:
            return "You can upload and parse your resume in the 'Profile' section. Once uploaded, it'll automatically generate an embedding vector for AI matching!"
        elif 'recruiter' in low or 'post' in low:
            return "Recruiters can post jobs in the 'Post Job' tab and track applicants with AI reviews in the 'Manage Jobs' dashboard."
        else:
            return "I'm here to help you with Job Buddy! You can ask me about recommended jobs, resume uploads, or how to post job listings. Let me know what you need."
