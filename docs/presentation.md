# Job Buddy — Walkthrough Script (5 Minutes)

> **Format**: Live code walkthrough, natural speaking style  
> **Audience**: CTO / Product Engineer evaluator  
> **Goal**: Show you think like an engineer who makes conscious trade-offs

---

## Walkthrough Map

```
0:00 – 0:45  │ Project Structure
0:45 – 1:15  │ Redis
1:15 – 1:55  │ Kafka
1:55 – 2:40  │ AI Matching & Analysis
2:40 – 3:10  │ Chat
3:10 – 3:40  │ UI
3:40 – 4:10  │ End-to-End Request Flow
4:10 – 5:00  │ Demo & Wrap-up
```

---

## 0:00 – 0:45 · Project Structure

**Show**: Open the project in VS Code, expand top-level folders, then drill into one service.

**Script**:

> Alright, so let me start by showing you how this project is organized. The whole thing lives under this root directory.
>
> [point at folders]
>
> You've got `backend/` with seven Django services — auth, profile, job, application, matching, notification, and chat. Each one is completely independent. They each have their own settings, their own models, their own database schema. If one service goes down, the others keep running.
>
> Now the thing I want you to notice is that every single service follows the exact same internal structure. Let me open one so you can see what I mean.
>
> [drill into matching_service/matching/]
>
> Inside `matching/`, you've got `models/` for the database tables, `dao/` for all the database query code, `services/` where the business logic lives, `handlers/` for orchestrating multi-step operations, `api/` for the HTTP views and serializers, `tasks/` for background jobs, and `migrations/` for database changes.
>
> And this layout is identical across all seven services. The idea is that if you know one service, you know all of them. There's no guesswork — you always know where to find the database code, where to find the business logic, where to find the API endpoints. It makes onboarding and maintenance a lot easier.

---

## 0:45 – 1:15 · Redis

**Show**: Open any `redis_client.py`, then show the rate limiting usage in auth service.

**Script**:

> Next up — Redis. I'm using Redis for five different things, and the common pattern across all of them is that nothing breaks if Redis goes down.
>
> [open a redis_client.py]
>
> Look at this — every single method is wrapped in a try-catch. If Redis is unreachable, the method returns `None` and the service just falls back to the database. You lose some performance, but you never get a 500 error. The user doesn't even notice.
>
> So what am I actually doing with Redis? Let me walk through it quickly.
>
> **Rate limiting** — when someone tries to log in, I store a counter in Redis keyed by their IP and email with a 60-second expiry. If they hit 5 attempts in a minute, they get blocked. I chose Redis over the database here because the automatic expiry means I never have to clean up old records. They just vanish.
>
> **Token blacklisting** — stateless JWTs are great, but they create a problem: how do you force a logout? I store blacklisted token IDs in Redis with a TTL set to however long the token had left to live. So a logout actually works, even though the tokens are stateless.
>
> **Caching** — job listings get cached for 5 minutes, categories for an hour, AI reviews for 24 hours. The AI review cache key is worth mentioning — it includes both the resume's last update timestamp and the job's last update timestamp. If either one changes, the cache key changes automatically and the review gets regenerated. No stale data, no manual invalidation.
>
> But caching is useless if you serve stale data. So when a job transitions between statuses — say from draft to published — I need to clear the cached listings so the next request gets fresh data. Instead of trying to delete individual cache keys for every possible filter combination, I use **pattern-based clearing**. A single call to `delete_pattern('jobs:list:*')` wipes every cached job listing in one go. The next request repopulates the cache from the database. It's simple, it's fast, and it guarantees freshness.
>
> And Redis also serves as the Celery broker for async tasks. So it's sort of the glue that holds a lot of the background processing together.

---

## 1:15 – 1:55 · Kafka

**Show**: Open a `kafka_client.py`, scroll to the fallback method, then show the DLQ and consumer command.

**Script**:

> Now let me talk about Kafka and how I handle the fact that distributed systems fail. In a microservices setup, services need to talk to each other, and the way they do that in this project is through events. But if the message broker goes down, you need a plan.
>
> [open a kafka_client.py — matching or notification service]
>
> Each service has a Kafka producer — one instance per service, shared across the whole thing. Creating a new Kafka connection per request would be wasteful, so it's a singleton. One connection, reused.
>
> [scroll to send_event, then to fallback_to_celery]
>
> When a service needs to publish an event, it calls `send_event`. If Kafka is available, great, the event goes through and we're done. But if Kafka isn't available — maybe the broker is restarting or there's a network issue — we catch that exception and hand the event off to a Celery task instead. That task retries up to 5 times with exponential backoff. So the event eventually gets through.
>
> [open notification service's kafka_client.py — point at DLQ]
>
> And for events that fail even after all those retries? They go to a Dead Letter Queue. A separate Kafka topic with the original event payload plus the error details. Nothing gets silently dropped. If something fails, there's a record of it.
>
> [open matching/management/commands/consume_events.py]
>
> On the consumer side, the Matching Service runs a long-lived process that listens for `resume.uploaded` and `job.published` events. When it gets one, it generates the embedding and stores it. The key thing here is that this is all async — the user who uploaded the resume gets their response immediately, and the AI processing happens in the background.
>
> So the chain is: try Kafka first, fall back to Celery with retries, and if everything fails, log it to the DLQ. Three layers, and the user's request is never blocked by any of it.

---

## 1:55 – 2:40 · AI Matching & Analysis

**Show**: `matching/utils.py` → `dao/job_dao.py` → `services/ai_service.py`

**Script**:

> This is the part that actually makes the product intelligent. Let me walk through how the AI features work under the hood.
>
> [open matching/utils.py — point at the SentenceTransformer line]
>
> First — embeddings. I'm using Sentence Transformers with the `all-MiniLM-L6-v2` model, which produces 384-dimensional vectors. The model is loaded once and cached in memory as a module-level variable. Loading a transformer model is expensive — it takes a couple of seconds and a lot of memory — so you definitely don't want to do it on every request. Singleton pattern, same idea as the Kafka producer.
>
> [open dao/job_dao.py — point at the CosineDistance line]
>
> Next — the actual matching. When a seeker wants to see matched jobs, I take their resume embedding and run a pgvector `CosineDistance` query against all the job embeddings. This finds the 10 jobs whose vector representations are closest to the resume's vector. The important thing is that this is semantic — it understands that "Django architect" and "Python developer" are related concepts, even if they don't share keywords.
>
> Now, a design decision I want to call out: I chose pgvector over a dedicated vector database like Pinecone. Here's my reasoning — pgvector lives in the same PostgreSQL database as everything else. Zero network latency for similarity searches, ACID compliance, and no extra infrastructure to manage. The trade-off is that it won't scale to millions of vectors as efficiently as Pinecone would. But for thousands of resumes and jobs, it's the right call. And the DAO layer abstracts the storage, so swapping to Pinecone later would only require changing that one file.
>
> [open services/ai_service.py — scroll to the generate_alignment_review method]
>
> Now the AI alignment review — this is the feature that generates match scores, strengths, gaps, and interview questions for each candidate against a job. I built it to support multiple AI providers. A single environment variable switches between Google Gemini, OpenAI, and OpenRouter.
>
> [point at the Gemini call, then the OpenAI call, then the fallback]
>
> The system sends a structured prompt with the candidate's profile data and the job requirements, and the LLM returns structured JSON. But here's the thing — AI APIs fail. They rate-limit you, they go down, your API key expires. So if the API call fails, the system falls back to a simulated review that analyzes the job domain and returns something that still looks professional. The user never sees an error page. They just get their alignment review.
>
> There's also a RAG chatbot that lets users ask things like "What Python jobs are available for someone with 5 years experience?" It embeds the question, searches for relevant jobs, injects that context into an LLM prompt, and generates an answer.

---

## 2:40 – 3:10 · Chat

**Show**: `chat_service/chat/models.py` → `views.py` → frontend chat component

**Script**:

> Let's look at the chat. Two tables — `Conversation` and `Message` — clean and simple. REST endpoints for the basic operations: create, list, send.
>
> The interesting part is how messages get delivered in real time. Instead of polling every few seconds, I wired up **WebSockets** using Django Channels. The ASGI server runs alongside the regular HTTP server — same port, same Nginx reverse proxy — and the WebSocket connections are authenticated using JWT tokens from the query string. When you send a message through the REST API, it broadcasts to the recipient's channel group instantly. No polling, no delay.
>
> If the connection drops — say a network blip — it reconnects automatically within a few seconds, and there's a guard flag to prevent duplicate connections from stacking up. So the user gets a seamless experience even on a flaky network.
>
> The frontend subscribes to incoming messages through a simple reactive stream, and the chat UI updates as they arrive. Genuinely real-time, no workarounds.
>
> There's also a subtle pulse animation on the chat icon that lights up when there are unread messages — triggered by those same WebSocket messages — so you know someone wrote to you even if you're on a different page.
>
> And every message also fires a Kafka event, which the Notification Service picks up to deliver an in-app notification to the recipient. So the chat feels responsive on its own, but the notification layer ensures nothing gets lost.

---

## 3:10 – 3:40 · UI

**Show**: `app.routes.ts` → a feature component with Signals → shared AI drawer → browser live

**Script**:

> Let me show you the frontend side now.
>
> [open app.routes.ts]
>
> All the routes use lazy loading with `loadComponent`. The initial bundle only has what's needed for the landing page. The other 9 feature pages load on demand. Keeps the first load fast.
>
> [open a feature component — point at signal(), computed(), effect()]
>
> For state management, I'm using Angular Signals. And again, this was a deliberate choice over something like NgRx. With NgRx, every piece of state needs actions, reducers, effects, and selectors. That's a lot of boilerplate for what this app needs. Signals give you `signal()` for state, `computed()` for derived values that update automatically, and `effect()` for side effects like managing the WebSocket lifecycle. It's framework-native, it's simple, and it's the right fit for this level of complexity.
>
> [open shared/components/ai-alignment-drawer]
>
> I built the AI Alignment Drawer as a reusable component. It's used across four different pages — match results, applications, job details, candidate details — but it's defined once. Same with the Chatbot Sidebar. Reusable components keep the codebase DRY.
>
> [switch to browser — show the app, toggle dark mode]
>
> In the browser, you can see the responsive layout — CSS Grid with breakpoints, works on desktop and mobile. Dark mode detects your system preference but also lets you toggle it manually, and it remembers your choice. Material Design theming throughout. Small touches like skeleton loading states while data fetches, and a scroll-to-bottom button in chat that only shows up when you've scrolled up.

---

## 3:40 – 4:10 · End-to-End Request Flow

**Show**: Trace a request — Angular service → nginx.conf → view → handler → DAO → Kafka

**Script**:

> Let me tie everything together by following one request from the browser all the way through the system.
>
> [open a frontend service file]
>
> A user clicks "Apply Now" on a job. The frontend sends a POST request through the ApiService, which wraps HttpClient. The JWT interceptor automatically adds the auth token from localStorage. If the token is expired, it refreshes it transparently.
>
> [open nginx/nginx.conf]
>
> In development, the request goes through a proxy to Nginx on port 80. Nginx looks at the URL path, matches `/api/applications/`, and forwards it to the Application Service on port 8004. CORS headers get added at the Nginx level so the browser never has to deal with preflight issues.
>
> [open the application handler]
>
> The Django view authenticates the user by decoding the JWT — every service does this independently, no need to call back to the auth service. Then the handler takes over. It validates the job exists, checks the user hasn't already applied, processes the screening answers, creates the application record.
>
> [open the kafka_client.py briefly]
>
> Then it publishes a Kafka event for the stage change. If Kafka is available, great. If not, Celery retries with backoff. The response goes back to the user immediately — "Application submitted" — while the notification gets processed asynchronously in the background.
>
> That's the pattern: synchronous for the user-facing operation, asynchronous for everything else. The user gets instant feedback, the system handles the rest behind the scenes.

---

## 4:10 – 5:00 · Demo & Wrap-up

**Show**: Quick live demo — upload resume → matched jobs → AI review → chat → dark mode

**Script**:

> Let me quickly show this working.
>
> [switch to browser — localhost:4200]
>
> I'll upload a sample resume. [upload a dummy PDF] The system parses it, generates the embedding in the background. Now when I go to the Matches page, you can see the AI-ranked job recommendations sorted by how closely they match.
>
> [navigate to Matches page]
>
> If I click "View AI Review" on any match, you get the alignment drawer — match score, strengths, gaps, interview questions. All generated from the actual content.
>
> [open the drawer]
>
> Here's the chat interface. [open a conversation] Clean two-panel layout, messages in order, unread indicator with the pulse animation.
>
> And dark mode. [toggle it] Picks up your system preference but you can override it.
>
> [close browser]
>
> So to summarize the key engineering decisions:
>
> Every service follows the same internal structure, so the codebase is predictable. Redis handles five different concerns with graceful degradation as the safety net. Kafka has a three-layer fallback chain so no event gets lost. The AI matching uses pgvector by deliberate trade-off over Pinecone, and the LLM integration falls back gracefully when APIs fail. Chat uses WebSockets with auto-reconnect for real-time messaging. And the frontend uses Signals over NgRx because it's the right fit for this app's complexity.
>
> Every decision was a trade-off, and I can explain why I chose each path over the alternatives.
>
> Thanks for watching.

---

## Appendix: Quick Reference

| Topic | File | What to Say |
|-------|------|-------------|
| **Consistent structure** | Any service folder | "Same layout in all 7 services — predictable, no guesswork" |
| **Redis graceful degradation** | Any `redis_client.py` | "Try-catch on everything — no crash if Redis is down" |
| **Redis rate limiting** | Auth service | "Auto-expiry means zero cleanup overhead" |
| **Kafka singleton** | Any `kafka_client.py` | "One connection per service, not one per request" |
| **Kafka fallback** | `kafka_client.py` — `fallback_to_celery()` | "Catches failure, retries with backoff" |
| **Kafka DLQ** | Notification `kafka_client.py` | "Failed events logged with error context — nothing lost" |
| **Sentence Transformer singleton** | `matching/utils.py` | "Loaded once, cached forever — expensive to reload" |
| **pgvector vs Pinecone** | `matching/dao/job_dao.py` | "Zero network latency, ACID, no extra infra — right call at this scale" |
| **AI fallback** | `matching/services/ai_service.py` | "User never sees an error — realistic fallback review" |
| **Chat WebSocket** | Frontend chat.service.ts | "WebSocket with auto-reconnect, RxJS Subjects for real-time delivery" |
| **Signals vs NgRx** | Any feature component | "Less boilerplate, framework-native, right-sized for this app" |
| **Lazy loading** | `app.routes.ts` | "Pages load on demand — fast initial bundle" |
| **Reusable components** | AI alignment drawer | "One component, four pages — keeps code DRY" |

## Appendix: Timestamp Cheat Sheet

| Time | Section | Open These |
|------|---------|------------|
| 0:00 | Structure | Root tree → matching_service/matching/ |
| 0:45 | Redis | `redis_client.py` → auth rate limiting |
| 1:15 | Kafka | `kafka_client.py` → fallback → DLQ → consumer |
| 1:55 | AI | `utils.py` → `dao/job_dao.py` → `ai_service.py` |
| 2:40 | Chat | `chat/models.py` → `views.py` → frontend component |
| 3:10 | UI | `app.routes.ts` → Signals → shared drawer → browser |
| 3:40 | Request Flow | Frontend service → nginx.conf → handler → DAO → Kafka |
| 4:10 | Demo | Browser — upload, matches, AI review, chat, dark mode |

## Appendix: Questions They Might Ask

| Likely Question | Your Answer |
|----------------|-------------|
| "How does the WebSocket chat handle reconnection?" | "The frontend WebSocket has a 3-second auto-reconnect with a guard flag to prevent duplicate connections. If the server goes down or the network drops, it reconnects automatically." |
| "Why pgvector instead of Pinecone?" | "pgvector gives us ACID compliance and zero network latency in the same database. At our scale it performs well. If we grow to millions of vectors, we swap the DAO layer — it's a single file change." |
| "What happens when Redis goes down?" | "Nothing breaks. Every Redis call is wrapped in try-catch. Caching is lost so things are slower, rate limiting is disabled so we're less secure — but the app keeps working." |
| "Kafka and Celery seem redundant — why both?" | "Kafka gives you a durable event log you can replay and partition. Celery gives you guaranteed execution with retry. They solve different problems. The fallback chain uses Kafka normally and Celery as the safety net when Kafka is unavailable." |
