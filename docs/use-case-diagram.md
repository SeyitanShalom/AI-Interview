# InterviewAI Use Case Diagram

This document models the main use cases for the InterviewAI platform based on the current Next.js routes, API routes, Supabase schema, and interview components.

## Actors

- Visitor: unauthenticated user browsing the public site.
- Candidate: job seeker practicing interviews or completing company interview links.
- Company Admin/Recruiter: company user who creates interview kits, job openings, invite links, and reviews candidates.
- AI Provider: Gemini/OpenAI services used for question generation, resume analysis, transcription, and feedback.
- Supabase: authentication, database, and storage backend.

## Mermaid Diagram

```mermaid
flowchart LR
  visitor["Visitor"]
  candidate["Candidate"]
  company["Company Admin / Recruiter"]
  ai["AI Provider"]
  supabase["Supabase"]

  subgraph system["InterviewAI Platform"]
    browse(["Browse landing, candidate, company, and pricing pages"])
    auth(["Register / sign in"])
    chooseRole(["Choose candidate or company role"])

    candidateProfile(["Manage candidate profile"])
    uploadResume(["Upload resume"])
    analyzeResume(["Analyze resume and extract role context"])
    practiceInterview(["Start practice interview"])
    applyLink(["Apply through job invite link"])
    takeKit(["Take company interview kit"])
    recordAnswer(["Record video/audio answer"])
    transcribe(["Transcribe recording"])
    generateFeedback(["Generate AI interview feedback"])
    viewCandidateResults(["View interview history and feedback"])

    companyProfile(["Create or join company workspace"])
    manageMembers(["Manage invite codes and company members"])
    createKit(["Create interview kit"])
    shareKit(["Share interview kit link"])
    createOpening(["Create job opening / application link"])
    reviewApplications(["Review candidate applications"])
    watchRecording(["Watch submitted recording"])
    viewFeedback(["View AI scores and feedback"])
    analytics(["View company analytics"])
    manageSessions(["Manage or delete candidate sessions"])

    storeData(["Store users, profiles, kits, applications, sessions, and recordings"])
  end

  visitor --> browse
  visitor --> auth
  auth --> chooseRole

  candidate --> auth
  candidate --> candidateProfile
  candidateProfile --> uploadResume
  uploadResume --> analyzeResume
  candidate --> practiceInterview
  candidate --> applyLink
  applyLink --> takeKit
  candidate --> takeKit
  practiceInterview --> recordAnswer
  takeKit --> recordAnswer
  recordAnswer --> transcribe
  transcribe --> generateFeedback
  generateFeedback --> viewCandidateResults
  candidate --> viewCandidateResults

  company --> auth
  company --> companyProfile
  company --> manageMembers
  company --> createKit
  createKit --> shareKit
  createKit --> createOpening
  company --> reviewApplications
  reviewApplications --> watchRecording
  reviewApplications --> viewFeedback
  company --> analytics
  company --> manageSessions

  analyzeResume -. uses .-> ai
  practiceInterview -. generates question with .-> ai
  transcribe -. uses .-> ai
  generateFeedback -. uses .-> ai

  auth -. uses .-> supabase
  candidateProfile -. saves to .-> supabase
  companyProfile -. saves to .-> supabase
  createKit -. saves to .-> supabase
  createOpening -. saves to .-> supabase
  recordAnswer -. uploads to .-> supabase
  generateFeedback -. saves to .-> supabase
  reviewApplications -. reads from .-> supabase
  storeData -. backed by .-> supabase
```

## PlantUML Version

Use this version if your lecturer expects a more traditional UML use case diagram.

```plantuml
@startuml
left to right direction

actor Visitor
actor Candidate
actor "Company Admin / Recruiter" as Company
actor "AI Provider\n(Gemini / OpenAI)" as AI
actor "Supabase\n(Auth / DB / Storage)" as Supabase

rectangle "InterviewAI Platform" {
  usecase "Browse public pages" as UC_Browse
  usecase "Register / sign in" as UC_Auth
  usecase "Choose user role" as UC_Role

  usecase "Manage candidate profile" as UC_Profile
  usecase "Upload resume" as UC_Resume
  usecase "Analyze resume" as UC_AnalyzeResume
  usecase "Start practice interview" as UC_Practice
  usecase "Apply through invite link" as UC_Apply
  usecase "Take company interview kit" as UC_TakeKit
  usecase "Record video/audio answer" as UC_Record
  usecase "Transcribe recording" as UC_Transcribe
  usecase "Generate AI feedback" as UC_Feedback
  usecase "View interview history and feedback" as UC_CandidateResults

  usecase "Create or join company workspace" as UC_CompanyProfile
  usecase "Manage company members and invite codes" as UC_Members
  usecase "Create interview kit" as UC_CreateKit
  usecase "Share interview kit link" as UC_ShareKit
  usecase "Create job opening / application link" as UC_CreateOpening
  usecase "Review candidate applications" as UC_Review
  usecase "Watch submitted recording" as UC_Watch
  usecase "View AI scores and feedback" as UC_ViewFeedback
  usecase "View company analytics" as UC_Analytics
  usecase "Manage candidate sessions" as UC_ManageSessions

  usecase "Store platform data" as UC_Store
}

Visitor --> UC_Browse
Visitor --> UC_Auth
UC_Auth ..> UC_Role : <<include>>

Candidate --> UC_Auth
Candidate --> UC_Profile
UC_Profile ..> UC_Resume : <<include>>
UC_Resume ..> UC_AnalyzeResume : <<include>>
Candidate --> UC_Practice
Candidate --> UC_Apply
UC_Apply ..> UC_TakeKit : <<extend>>
Candidate --> UC_TakeKit
UC_Practice ..> UC_Record : <<include>>
UC_TakeKit ..> UC_Record : <<include>>
UC_Record ..> UC_Transcribe : <<include>>
UC_Transcribe ..> UC_Feedback : <<include>>
Candidate --> UC_CandidateResults

Company --> UC_Auth
Company --> UC_CompanyProfile
Company --> UC_Members
Company --> UC_CreateKit
UC_CreateKit ..> UC_ShareKit : <<include>>
UC_CreateOpening ..> UC_CreateKit : <<include>>
Company --> UC_CreateOpening
Company --> UC_Review
UC_Review ..> UC_Watch : <<include>>
UC_Review ..> UC_ViewFeedback : <<include>>
Company --> UC_Analytics
Company --> UC_ManageSessions

AI --> UC_AnalyzeResume
AI --> UC_Practice
AI --> UC_Transcribe
AI --> UC_Feedback

Supabase --> UC_Auth
Supabase --> UC_Profile
Supabase --> UC_CompanyProfile
Supabase --> UC_CreateKit
Supabase --> UC_CreateOpening
Supabase --> UC_Record
Supabase --> UC_Feedback
Supabase --> UC_Review
Supabase --> UC_Store
@enduml
```

## Notes

- `Apply through invite link` maps to `/apply/[token]`.
- `Take company interview kit` maps to `/interview/kit/[id]/take`.
- Candidate account flows map to `/candidate/auth`, `/candidate/dashboard`, and `/candidate/profile`.
- Company account flows map to `/company/auth` and `/company/dashboard`.
- Supporting services include Supabase Auth/Database/Storage and Gemini/OpenAI AI processing.
